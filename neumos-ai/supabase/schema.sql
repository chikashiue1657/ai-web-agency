-- ============================================================
-- Neumos AI v1 - Supabase スキーマ
-- ------------------------------------------------------------
-- Neumos AI v1自身が生成結果を永続化するためのテーブル。
-- Vercelサーバーレス環境ではインスタンスが使い捨て・複数並行のため、
-- インメモリ保存では /preview/[requestId] がサーバー再起動やインスタンス切替で
-- 「見つかりません」になってしまう。ここに保存することで、
-- Neumos AI v1のどのインスタンス・再起動後からでもプレビューを再取得できる。
--
-- 注意: AI集客支援MVP側のSupabaseプロジェクトとは別物（Neumos AI v1専用DB）。
-- 両者は独立したサービスであり、DBを共有しない設計を維持する。
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists content_generation_requests (
  request_id         text primary key,              -- performGeneration()が発行するUUID
  generation_type    text not null default 'website',
  brief              jsonb not null,                 -- StoreBrief
  status             text not null default 'preview', -- queued|generating|preview|published|failed
  method             text not null default 'rule',    -- rule|rule+llm
  generated_contents jsonb not null,                 -- GeneratedWebsiteContents
  preview_html       text not null,                  -- 静的書き出し用の単体HTML
  preview_url        text not null,
  published_url      text,
  created_at         timestamptz not null default now()
);

create index if not exists content_gen_requests_created_idx
  on content_generation_requests (created_at desc);

-- ============================================================
-- 既存テーブルへの追従用マイグレーション
-- ------------------------------------------------------------
-- `create table if not exists` は既にテーブルが存在する環境には効かないため、
-- 上のcreate table定義へカラムを追加しただけでは本番DBに反映されない
-- （実例: methodカラムが本番テーブルに存在せずPGRST204「Could not find the
-- 'method' column」が発生）。今後カラムを追加する場合も、この節に
-- add column if not existsを追記した上でschema.sqlを再実行すれば、
-- 新規作成・既存テーブルのどちらにも同じ結果になる。
-- ============================================================
alter table content_generation_requests
  add column if not exists generation_type text not null default 'website';
alter table content_generation_requests
  add column if not exists status text not null default 'preview';
alter table content_generation_requests
  add column if not exists method text not null default 'rule';
alter table content_generation_requests
  add column if not exists published_url text;

-- ============================================================
-- RLS（雛形）: v1はservice role経由のサーバアクセス前提。今は無効のまま。
-- ------------------------------------------------------------
-- alter table content_generation_requests enable row level security;
