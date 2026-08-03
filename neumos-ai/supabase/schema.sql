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
grant select, insert, update on table neumos_site_inquiries to service_role;

-- ============================================================
-- RLS（雛形）: v1はservice role経由のサーバアクセス前提。今は無効のまま。
-- ------------------------------------------------------------
-- alter table neumos_content_generation_requests enable row level security;

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
