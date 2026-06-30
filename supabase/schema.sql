-- AI集客支援サービス DB スキーマ
-- Supabase SQL Editor で実行してください

-- 店舗テーブル
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  phone TEXT,
  opening_hours JSONB,
  rating NUMERIC(3,1),
  review_count INTEGER DEFAULT 0,
  photo_count INTEGER DEFAULT 0,
  website_url TEXT,
  instagram_url TEXT,
  facebook_url TEXT,
  has_website BOOLEAN DEFAULT false,
  area TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- リード（営業案件）テーブル
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  priority_rank TEXT CHECK (priority_rank IN ('A', 'B', 'C')),
  score INTEGER DEFAULT 0,
  reasons JSONB DEFAULT '[]',
  sales_angle TEXT,
  risk_flags JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'meeting', 'proposal_sent', 'negotiating', 'won', 'lost', 'on_hold')),
  contact_method TEXT,
  last_contacted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 提案書テーブル
CREATE TABLE IF NOT EXISTS proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  summary TEXT,
  problems JSONB DEFAULT '[]',
  opportunities JSONB DEFAULT '[]',
  suggested_sections JSONB DEFAULT '[]',
  sales_message TEXT,
  generated_markdown TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 生成サイトテーブル
CREATE TABLE IF NOT EXISTS generated_sites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  theme_type TEXT NOT NULL DEFAULT 'modern',
  language TEXT NOT NULL DEFAULT 'ja',
  generated_json JSONB,
  published_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'preview', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 活動履歴テーブル
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_stores_area ON stores(area);
CREATE INDEX IF NOT EXISTS idx_stores_category ON stores(category);
CREATE INDEX IF NOT EXISTS idx_stores_has_website ON stores(has_website);
CREATE INDEX IF NOT EXISTS idx_leads_store_id ON leads(store_id);
CREATE INDEX IF NOT EXISTS idx_leads_priority_rank ON leads(priority_rank);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_proposals_store_id ON proposals(store_id);
CREATE INDEX IF NOT EXISTS idx_generated_sites_store_id ON generated_sites(store_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_store_id ON activity_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER generated_sites_updated_at BEFORE UPDATE ON generated_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
