-- ============================================================
-- AI集客支援サービス MVP - Supabase スキーマ
-- ------------------------------------------------------------
-- 設計方針:
--  - place_id を一意キーの第一候補とする（NULL許容、部分ユニーク）
--  - JSONカラム(raw_payload / reasons / generated_json 等)で柔軟性を確保
--  - マルチテナント化に備え tenant_id を予約（既定 NULL、後で NOT NULL 化可能）
--  - updated_at は trigger で自動更新
-- ============================================================

-- 拡張: gen_random_uuid()
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 共通: updated_at 自動更新トリガ関数
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- stores: 店舗マスタ（正規化後の店舗情報）
-- ============================================================
create table if not exists stores (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,                                  -- 将来のマルチテナント用（予約）
  place_id      text,                                  -- Google Places place_id（最優先キー）
  name          text not null,
  category      text,                                  -- 業種（正規化済みカテゴリ）
  address       text,
  phone         text,
  opening_hours jsonb,                                 -- 営業時間（構造化 or 生テキスト配列）
  rating        numeric(3,2),                          -- 0.00〜5.00
  review_count  integer default 0,
  photo_count   integer default 0,
  website_url   text,
  instagram_url text,
  facebook_url  text,
  has_website   boolean default false,
  area          text,                                  -- エリア（例: 那覇市, 北谷町）
  source        text,                                  -- 取得元: google_places | apify | csv | manual
  raw_payload   jsonb,                                 -- 取得元の生データ（監査・再正規化用）
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- place_id があれば一意（NULLは重複許容 = HPなし手入力等を考慮）
create unique index if not exists stores_place_id_key
  on stores (place_id) where place_id is not null;

create index if not exists stores_category_idx on stores (category);
create index if not exists stores_area_idx on stores (area);
create index if not exists stores_has_website_idx on stores (has_website);

drop trigger if exists trg_stores_updated_at on stores;
create trigger trg_stores_updated_at before update on stores
  for each row execute function set_updated_at();

-- ============================================================
-- leads: 営業リード（優先度判定 + 営業ステータス）
--   store と 1:1 を基本とする（store_id ユニーク）
-- ============================================================
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  priority_rank    text check (priority_rank in ('A','B','C')),
  score            integer,                            -- 0〜100
  reasons          jsonb,                              -- string[]: 判定根拠（説明可能性）
  sales_angle      text,                               -- 営業切り口
  risk_flags       jsonb,                              -- string[]: 注意点
  status           text default 'todo',                -- 営業ファネル: todo|dm_sent|called|negotiating|won|lost
  contact_method   text,                               -- phone|email|visit|dm 等
  last_contacted_at timestamptz,
  notes            text,                               -- 営業メモ
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (store_id)
);

create index if not exists leads_priority_idx on leads (priority_rank);
create index if not exists leads_status_idx on leads (status);

drop trigger if exists trg_leads_updated_at on leads;
create trigger trg_leads_updated_at before update on leads
  for each row execute function set_updated_at();

-- ============================================================
-- proposals: 営業提案書（Markdown + 構造化フィールド）
--   履歴を残せるよう store:proposal は 1:N
-- ============================================================
create table if not exists proposals (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references stores(id) on delete cascade,
  summary            text,                             -- オーナー向け5分要約
  problems           jsonb,                            -- string[]: 機会損失/課題
  opportunities      jsonb,                            -- string[]: 機会
  suggested_sections jsonb,                            -- string[]: 推奨ページ構成
  sales_message      text,                             -- 簡易営業メッセージ
  generated_markdown text,                             -- 提案書本文(Markdown)
  created_at         timestamptz not null default now()
);

create index if not exists proposals_store_idx on proposals (store_id);

-- ============================================================
-- generated_sites: 仮デモサイト（JSON schemaベース）
-- ============================================================
create table if not exists generated_sites (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references stores(id) on delete cascade,
  slug           text not null unique,                 -- 公開URL用スラッグ
  theme_type     text,                                 -- washoku|modern|resort|clean|luxury|natural|trust 等
  language       text default 'ja',
  generated_json jsonb,                                -- サイト構造（ページ/セクション/SEO）
  published_url  text,                                 -- 公開後URL（将来の公開自動化）
  status         text default 'draft',                 -- draft|preview|published|archived
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists generated_sites_store_idx on generated_sites (store_id);

drop trigger if exists trg_generated_sites_updated_at on generated_sites;
create trigger trg_generated_sites_updated_at before update on generated_sites
  for each row execute function set_updated_at();

-- ============================================================
-- store_strategies: Thinking Engine の店舗診断（store と 1:1）
--   強み/弱み/課題/ターゲット/受注確率/営業切り口/おすすめ提案 等を保持。
--   戦略本体は data(jsonb) に格納し、検索用に一部をカラム化する。
-- ============================================================
create table if not exists store_strategies (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references stores(id) on delete cascade,
  confidence_score integer,                              -- 受注確率(0-100)
  sales_angle      text,                                 -- 営業切り口
  data             jsonb not null,                       -- StoreStrategy 本体
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (store_id)
);

create index if not exists store_strategies_store_idx on store_strategies (store_id);

drop trigger if exists trg_store_strategies_updated_at on store_strategies;
create trigger trg_store_strategies_updated_at before update on store_strategies
  for each row execute function set_updated_at();

-- ============================================================
-- content_generation_requests: コンテンツ生成リクエスト（ノイモスAI連携）
--   営業支援 → 受注 → 生成 → 公開 の記録。NeumosBrief(契約)を保持する。
--   generation_type で website / blog / instagram 等を区別（同じbriefから複数種別）。
-- ============================================================
create table if not exists content_generation_requests (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references stores(id) on delete cascade,
  provider        text not null default 'neumos',       -- 生成エンジン
  generation_type text not null default 'website',      -- website|landing_page|instagram_post|google_business_improvement|blog_post|faq|seo_content|copywriting
  status          text not null default 'draft',         -- draft|requested|queued|generating|preview|published|failed
  brief              jsonb,                              -- NeumosBrief（ノイモスAIへの受け渡し契約）
  external_id        text,                               -- ノイモスAI側 requestId
  preview_url        text,
  published_url      text,
  generated_contents jsonb,                              -- 生成物（ページ/セクション/コピー等）
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists content_gen_requests_store_idx on content_generation_requests (store_id);
create index if not exists content_gen_requests_status_idx on content_generation_requests (status);
create index if not exists content_gen_requests_type_idx on content_generation_requests (generation_type);

drop trigger if exists trg_content_gen_requests_updated_at on content_generation_requests;
create trigger trg_content_gen_requests_updated_at before update on content_generation_requests
  for each row execute function set_updated_at();

-- ============================================================
-- 既存テーブルへの追従用マイグレーション（部分的なカラム不足のみの場合）
-- ------------------------------------------------------------
-- `create table if not exists` は既にテーブルが存在する環境には効かないため、
-- 上のcreate table定義へカラムを追加しただけでは本番DBに反映されない
-- （実例: errorカラムが本番テーブルに存在せずPGRST204
-- 「Could not find the 'error' column」が発生）。今後カラムを追加する場合も
-- この節にadd column if not existsを追記した上でこのファイルを再実行すれば、
-- 新規作成・既存テーブルのどちらにも同じ結果になる。
--
-- 注意: store_idのような当初からの必須カラムまで不足を報告される場合、
-- テーブルはこのファイルとは無関係な構造で作られている（＝差分ALTERでは
-- 収束しない）ため、下の「全面リセット」を使うこと
-- （実例: 本番でerror修正後もstore_idが見つからずPGRST204が再発）。
-- ============================================================
alter table content_generation_requests
  add column if not exists provider text not null default 'neumos';
alter table content_generation_requests
  add column if not exists generation_type text not null default 'website';
alter table content_generation_requests
  add column if not exists status text not null default 'draft';
alter table content_generation_requests
  add column if not exists brief jsonb;
alter table content_generation_requests
  add column if not exists external_id text;
alter table content_generation_requests
  add column if not exists preview_url text;
alter table content_generation_requests
  add column if not exists published_url text;
alter table content_generation_requests
  add column if not exists generated_contents jsonb;
alter table content_generation_requests
  add column if not exists error text;
alter table content_generation_requests
  add column if not exists updated_at timestamptz not null default now();

-- ============================================================
-- 全面リセット（テーブル構造がこのファイルと大きく乖離している場合）
-- ------------------------------------------------------------
-- 既存の生成リクエスト履歴は全て失われる（stores等の他テーブルには影響しない）。
-- 過去データの保持が不要な場合のみ、上のALTER節の代わりにこちらを使う。
-- ------------------------------------------------------------
-- drop table if exists content_generation_requests;
-- （その後、上の create table / create index / create trigger をそのまま実行する）

-- ============================================================
-- PostgRESTスキーマキャッシュの強制リロード
-- ------------------------------------------------------------
-- SQL Editorでのcreate/alter table直後、PostgREST側のスキーマキャッシュが
-- 即時反映されず、実際には存在するカラムでも「Could not find the 'X' column」
-- （PGRST204）が一時的に返ることがある。DDL変更のたびに必ず最後に実行する。
-- ============================================================
notify pgrst, 'reload schema';

-- ============================================================
-- activity_logs: 活動履歴（取り込み/判定/生成/営業メモ等）
-- ============================================================
create table if not exists activity_logs (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid references stores(id) on delete cascade,
  event_type text not null,                            -- store.ingested|lead.scored|proposal.generated|site.generated|lead.note_updated 等
  payload    jsonb,                                    -- イベント詳細
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_store_idx on activity_logs (store_id);
create index if not exists activity_logs_event_idx on activity_logs (event_type);

-- ============================================================
-- RLS（雛形）: MVPでは service role 経由のサーバアクセス前提。
-- 認証導入時に有効化する。今は無効のままにしておく。
-- ------------------------------------------------------------
-- alter table stores enable row level security;
-- alter table leads enable row level security;
-- alter table proposals enable row level security;
-- alter table generated_sites enable row level security;
-- alter table activity_logs enable row level security;
