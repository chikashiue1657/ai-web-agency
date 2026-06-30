// ============================================================
// コアドメイン型定義
// ============================================================

export type PriorityRank = 'A' | 'B' | 'C'
export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'meeting'
  | 'proposal_sent'
  | 'negotiating'
  | 'won'
  | 'lost'
  | 'on_hold'
export type SiteStatus = 'draft' | 'preview' | 'published' | 'archived'
export type StoreSource = 'google_places' | 'apify' | 'csv' | 'manual'

// ============================================================
// Store
// ============================================================

export interface Store {
  id: string
  place_id: string | null
  name: string
  category: string | null
  address: string | null
  phone: string | null
  opening_hours: OpeningHours | null
  rating: number | null
  review_count: number
  photo_count: number
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  has_website: boolean
  area: string | null
  source: StoreSource
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface OpeningHours {
  periods?: Array<{
    open: { day: number; time: string }
    close?: { day: number; time: string }
  }>
  weekday_text?: string[]
}

// 一覧表示用（JOINデータ含む）
export interface StoreWithLead extends Store {
  lead: Lead | null
}

// 入力用（idや日時は不要）
export type StoreInput = Omit<Store, 'id' | 'created_at' | 'updated_at'>

// ============================================================
// Lead（営業リード）
// ============================================================

export interface Lead {
  id: string
  store_id: string
  priority_rank: PriorityRank | null
  score: number
  reasons: string[]
  sales_angle: string | null
  risk_flags: string[]
  status: LeadStatus
  contact_method: string | null
  last_contacted_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type LeadInput = Omit<Lead, 'id' | 'created_at' | 'updated_at'>

// ============================================================
// Proposal（提案書）
// ============================================================

export interface Proposal {
  id: string
  store_id: string
  summary: string | null
  problems: string[]
  opportunities: string[]
  suggested_sections: SuggestedSection[]
  sales_message: string | null
  generated_markdown: string | null
  created_at: string
}

export interface SuggestedSection {
  title: string
  description: string
}

// ============================================================
// GeneratedSite（仮デモサイト）
// ============================================================

export interface GeneratedSite {
  id: string
  store_id: string
  slug: string
  theme_type: ThemeType
  language: string
  generated_json: SiteSchema | null
  published_url: string | null
  status: SiteStatus
  created_at: string
  updated_at: string
}

export type ThemeType =
  | 'japanese'      // 和風
  | 'modern'        // モダン
  | 'resort'        // リゾート
  | 'clean'         // 清潔感
  | 'luxury'        // 高級感
  | 'natural'       // ナチュラル
  | 'trustworthy'   // 信頼感（医療系）

// サイト生成JSONスキーマ
export interface SiteSchema {
  meta: SiteMeta
  pages: SitePage[]
  theme: SiteTheme
}

export interface SiteMeta {
  title: string
  description: string
  keywords: string[]
  og_image?: string
  lang: string
}

export interface SitePage {
  id: string
  slug: string
  title: string
  sections: PageSection[]
}

export interface PageSection {
  type: SectionType
  data: Record<string, unknown>
}

export type SectionType =
  | 'hero'
  | 'about'
  | 'menu'
  | 'gallery'
  | 'access'
  | 'faq'
  | 'contact'
  | 'reviews'
  | 'cta'

export interface SiteTheme {
  type: ThemeType
  primary_color: string
  accent_color: string
  font_family: string
}

// ============================================================
// ActivityLog（活動履歴）
// ============================================================

export type ActivityEventType =
  | 'store_imported'
  | 'priority_evaluated'
  | 'proposal_generated'
  | 'site_generated'
  | 'note_updated'
  | 'status_changed'
  | 'contacted'

export interface ActivityLog {
  id: string
  store_id: string | null
  event_type: ActivityEventType
  payload: Record<string, unknown>
  created_at: string
}

// ============================================================
// API リクエスト / レスポンス
// ============================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

// 店舗一覧フィルタ
export interface StoreFilters {
  search?: string
  category?: string
  area?: string
  priority_rank?: PriorityRank
  has_website?: boolean
  status?: LeadStatus
  page?: number
  per_page?: number
  sort_by?: 'rating' | 'review_count' | 'created_at' | 'score'
  sort_order?: 'asc' | 'desc'
}

// 優先度判定の入力
export interface PriorityInput {
  store_id: string
  name: string
  category: string | null
  rating: number | null
  review_count: number
  photo_count: number
  has_website: boolean
  instagram_url: string | null
  facebook_url: string | null
  area: string | null
  opening_hours: OpeningHours | null
  description?: string
  review_summary?: string
}

// 優先度判定の出力
export interface PriorityResult {
  priority_rank: PriorityRank
  score: number
  reasons: string[]
  sales_angle: string
  risk_flags: string[]
  rule_score: number
  llm_correction: number | null
}

// 提案書生成の入力
export interface ProposalInput {
  store: Store
  lead: Lead | null
  review_summary?: string
  target_customers?: string
}

// サイト生成の入力
export interface SiteGenerationInput {
  store: Store
  theme_type?: ThemeType
  language?: string
  review_summary?: string
}

// ============================================================
// データ正規化
// ============================================================

// Google Places APIレスポンス（部分）
export interface GooglePlaceRaw {
  place_id?: string
  name?: string
  formatted_address?: string
  international_phone_number?: string
  formatted_phone_number?: string
  opening_hours?: {
    periods?: OpeningHours['periods']
    weekday_text?: string[]
  }
  rating?: number
  user_ratings_total?: number
  photos?: unknown[]
  website?: string
  url?: string
  types?: string[]
  vicinity?: string
}

// Apify Google Maps Scraper レスポンス（部分）
export interface ApifyPlaceRaw {
  placeId?: string
  title?: string
  address?: string
  phone?: string
  openingHours?: Array<{ day: string; hours: string }>
  totalScore?: number
  reviewsCount?: number
  imageCount?: number
  website?: string
  socialMedia?: {
    instagram?: string
    facebook?: string
  }
  categoryName?: string
  neighborhood?: string
  city?: string
}

// CSVインポート用
export interface CsvPlaceRaw {
  name?: string
  category?: string
  address?: string
  phone?: string
  rating?: string
  review_count?: string
  website?: string
  instagram?: string
  facebook?: string
  area?: string
  [key: string]: string | undefined
}

// ダッシュボード統計
export interface DashboardStats {
  total_stores: number
  priority_a: number
  priority_b: number
  priority_c: number
  no_website: number
  new_this_week: number
  proposals_generated: number
  sites_generated: number
}
