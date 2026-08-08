-- ============================================================
-- Neumos AI v1 - Supabase スキーマ
-- ------------------------------------------------------------
-- Neumos AI v1自身が生成結果を永続化するためのテーブル。
-- Vercelサーバーレス環境ではインスタンスが使い捨て・複数並行のため、
-- インメモリ保存では /preview/[requestId] がサーバー再起動やインスタンス切替で
-- 「見つかりません」になってしまう。ここに保存することで、
-- Neumos AI v1のどのインスタンス・再起動後からでもプレビューを再取得できる。
--
-- 注意: AI集客支援MVP側のSupabaseプロジェクトとは別物にする設計（Neumos AI v1専用DB）。
-- 両者は独立したサービスであり、DBを共有しない設計を維持する。
--
-- 重要: テーブル名にneumos_接頭辞を付けている。
-- 過去に、MVPとNeumos AI v1が同一のSupabaseプロジェクトを共有してしまい、
-- 双方が同じテーブル名 content_generation_requests を使っていたため、
-- 片方のdrop table/create table（スキーマ修復のつもり）がもう片方を破壊し、
-- PGRST204（Could not find the 'X' column）が交互に再発し続ける事故が起きた。
-- 同一プロジェクトを共有する運用になった場合でも衝突しないよう、
-- 本ファイルは今後も content_generation_requests という生の名前を使わないこと。
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists neumos_content_generation_requests (
  request_id         text primary key,              -- performGeneration()が発行するUUID
  generation_type    text not null default 'website',
  brief              jsonb not null,                 -- StoreBrief
  status             text not null default 'preview', -- queued|generating|preview|published|failed
  method             text not null default 'rule',    -- rule|rule+llm
  generated_contents jsonb not null,                 -- GeneratedWebsiteContents
  preview_html       text not null,                  -- 静的書き出し用の単体HTML
  preview_url        text not null,
  published_url      text,
  created_at         timestamptz not null default now(),
  -- カフェ業態のみ、生成時（performGeneration）に一度だけ作成されるBrandPlan。
  -- v2プレビュー（/preview/[requestId]/v2）のレンダリング時には絶対にOpenAIを
  -- 呼ばないため、ここに保存された値をそのまま読むだけにする。nullable
  -- （カフェ以外の業種・列追加前に作成された旧レコードはnull）。
  brand_plan         jsonb
);

create index if not exists neumos_content_gen_requests_created_idx
  on neumos_content_generation_requests (created_at desc);

-- ============================================================
-- 既存テーブルへの追従用マイグレーション（部分的なカラム不足のみの場合）
-- ------------------------------------------------------------
-- `create table if not exists` は既にテーブルが存在する環境には効かないため、
-- 上のcreate table定義へカラムを追加しただけでは本番DBに反映されない。
-- 今後カラムを追加する場合も、この節にadd column if not existsを追記した上で
-- schema.sqlを再実行すれば、新規作成・既存テーブルのどちらにも同じ結果になる。
-- ============================================================
alter table neumos_content_generation_requests
  add column if not exists generation_type text not null default 'website';
alter table neumos_content_generation_requests
  add column if not exists status text not null default 'preview';
alter table neumos_content_generation_requests
  add column if not exists method text not null default 'rule';
alter table neumos_content_generation_requests
  add column if not exists published_url text;
alter table neumos_content_generation_requests
  add column if not exists brand_plan jsonb;

-- 公開v2サイトから受け付けた予約・問い合わせ。
-- ブラウザからSupabaseへ直接接続せず、Neumosサーバーのservice_roleだけが
-- 読み書きする。メール通知に失敗しても問い合わせ本体はこのテーブルに残る。
--
-- 保持期間の運用方針: 初期値180日。created_at基準で180日を超えたレコードは
-- 削除対象とする。個別削除はDELETE /v1/inquiries/[id]（NEUMOS_API_KEY認証、
-- 物理削除。deleted_at等の論理削除フラグは持たない設計）で可能。
-- 180日超過分の定期削除（自動化）は、Supabaseの実プランでpg_cron拡張が
-- 利用可能かどうかを確認できていないため本schema.sqlには含めていない
-- （利用可否を推測でスキーマに書かない）。確認でき次第、別PRで
-- pg_cronによるスケジュール削除、またはVercel Cron経由の削除エンドポイントを
-- 追加する。それまでは手動運用（個別削除、または本schema.sqlのコメントを
-- 参照した手動SQL実行）を前提とする。
create table if not exists neumos_site_inquiries (
  id               uuid primary key default gen_random_uuid(),
  request_id       text not null references neumos_content_generation_requests(request_id),
  store_name       text not null,
  inquiry_type     text not null check (inquiry_type in ('reservation', 'general')),
  name             text not null,
  email            text,
  phone            text,
  preferred_date   date,
  message          text not null,
  status           text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  dedupe_key       text not null unique,
  source_ip_hash   text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create index if not exists neumos_site_inquiries_created_idx
  on neumos_site_inquiries (created_at desc);
create index if not exists neumos_site_inquiries_request_idx
  on neumos_site_inquiries (request_id, created_at desc);
create index if not exists neumos_site_inquiries_status_idx
  on neumos_site_inquiries (status, created_at desc);

alter table neumos_site_inquiries enable row level security;
revoke all privileges on table neumos_site_inquiries from anon, authenticated;
-- deleteはDELETE /v1/inquiries/[id]（管理者・NEUMOS_API_KEY認証）用。
-- 公開エンドポイント（POST /api/public/inquiries）のコード経路には
-- 削除処理を実装しない。
grant select, insert, update, delete on table neumos_site_inquiries to service_role;

-- ============================================================
-- 問い合わせのレート制限（サーバーレス環境でインスタンスをまたいで
-- 正確に機能させるため、プロセスローカルなインメモリではなくPostgres側で
-- 原子的にカウントする）。
-- ============================================================
create table if not exists neumos_inquiry_rate_limit (
  bucket_key   text primary key,
  window_start timestamptz not null,
  count        integer not null default 1,
  updated_at   timestamptz not null default now()
);

create index if not exists neumos_inquiry_rate_limit_updated_idx
  on neumos_inquiry_rate_limit (updated_at);

alter table neumos_inquiry_rate_limit enable row level security;
revoke all privileges on table neumos_inquiry_rate_limit from anon, authenticated;
grant select, insert, update, delete on table neumos_inquiry_rate_limit to service_role;

-- 1つのUPSERT文でread-modify-writeを原子化する。Postgresの行ロックにより、
-- 同一bucket_keyへの同時アクセスはこの文の中で直列化されるため、サーバーレス
-- の複数インスタンスから同時にヒットしてもカウントが正確に保たれる。
--
-- search_pathを空文字にし、テーブル参照を`public.neumos_inquiry_rate_limit`と
-- 完全修飾する。search_path乗っ取り（同名オブジェクトを別スキーマへ差し替えて
-- 関数解決を誤誘導する攻撃）を防ぐための標準的な硬化パターン。now()や
-- interval等の組み込み関数・型はpg_catalogにあり、search_pathの設定に
-- 関わらず常に解決されるため空文字でも問題ない。
create or replace function inquiry_rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.neumos_inquiry_rate_limit (bucket_key, window_start, count, updated_at)
  values (p_key, now(), 1, now())
  on conflict (bucket_key) do update
    set count = case
          when public.neumos_inquiry_rate_limit.window_start < now() - (p_window_seconds || ' seconds')::interval
            then 1
          else public.neumos_inquiry_rate_limit.count + 1
        end,
        window_start = case
          when public.neumos_inquiry_rate_limit.window_start < now() - (p_window_seconds || ' seconds')::interval
            then now()
          else public.neumos_inquiry_rate_limit.window_start
        end,
        updated_at = now()
  returning count into v_count;

  return v_count > p_max;
end;
$$;

-- 実行権限を明示的に絞る。デフォルトではPUBLICにEXECUTEが付与されうるため、
-- 明示的にrevokeしたうえでservice_roleにのみ許可する。create or replace
-- functionは既存のGRANT/REVOKEをリセットしないため、schema.sqlを複数回
-- 実行しても最終状態は変わらない（冪等）。
revoke execute on function inquiry_rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function inquiry_rate_limit_hit(text, integer, integer)
  to service_role;

-- ============================================================
-- 権限退行防止: v1はservice role経由のサーバアクセス前提。
-- ------------------------------------------------------------
-- 既存Production（既にRLS有効・anon/authenticatedへのGRANTなし・
-- service_roleのみCRUD可能な状態）には影響しない。この節の目的は、
-- schema.sqlから新規環境（fresh Staging等）を構築した際に、この
-- テーブルがRLS無効・anon/authenticatedにData API経由の匿名CRUDを
-- 許してしまう権限退行を防ぐこと。anon/authenticated向けのpolicyは
-- 意図的に作らない（サーバー側のservice_role経由アクセスのみを許可する
-- 設計を維持するため）。以下はいずれも複数回実行して安全（RLS有効化は
-- 既に有効な場合はno-op、revoke/grantは何度実行しても同じ結果になる）。
alter table neumos_content_generation_requests
  enable row level security;

revoke all privileges
  on table neumos_content_generation_requests
  from public, anon, authenticated;

grant select, insert, update, delete
  on table neumos_content_generation_requests
  to service_role;

-- ============================================================
-- PostgRESTスキーマキャッシュの強制リロード
-- ------------------------------------------------------------
-- SQL Editorでのcreate/alter table直後、PostgREST側のスキーマキャッシュが
-- 即時反映されず、実際には存在するカラムでも「Could not find the 'X' column」
-- （PGRST204）が一時的に返ることがある。DDL変更のたびに必ず最後に実行する。
-- ============================================================
notify pgrst, 'reload schema';

-- v2のAI補助画像用。公開サイトで表示するためpublic bucketとする。
-- 書き込みはservice_roleを使うサーバー生成処理からのみ行う。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('neumos-generated-assets', 'neumos-generated-assets', true, 10485760, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
