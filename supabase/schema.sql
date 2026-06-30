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
  status           text default 'new',                 -- new|contacted|in_progress|won|lost|on_hold
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
