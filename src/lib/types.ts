/**
 * ドメイン型定義（DBスキーマと1:1対応）
 * - DBの行型(Row)とアプリ内ドメイン型を一致させ、Repository層で変換コストを最小化する。
 * - 文字列リテラル型で取りうる値を明示し、説明可能性・型安全性を高める。
 */

/** 営業優先度ランク */
export type PriorityRank = "A" | "B" | "C";

/** 店舗データの取得元 */
export type StoreSource = "google_places" | "apify" | "csv" | "manual";

/** 営業ステータス */
export type LeadStatus =
  | "new"
  | "contacted"
  | "in_progress"
  | "won"
  | "lost"
  | "on_hold";

/** 仮サイトのステータス */
export type SiteStatus = "draft" | "preview" | "published" | "archived";

/** 業種カテゴリ（正規化後の代表値。拡張しやすいよう union + string で許容） */
export type StoreCategory =
  | "restaurant" // 飲食
  | "cafe" // カフェ
  | "izakaya" // 居酒屋
  | "beauty" // 美容（美容室/ネイル/エステ）
  | "clinic" // 医療/クリニック
  | "hotel" // 宿泊
  | "retail" // 小売
  | "other"; // その他

/** 営業時間（柔軟に保持。構造化できなければ raw に生テキストを入れる） */
export interface OpeningHours {
  raw?: string[];
  weekday_text?: string[];
}

// ------------------------------------------------------------
// stores
// ------------------------------------------------------------
export interface Store {
  id: string;
  tenant_id: string | null;
  place_id: string | null;
  name: string;
  category: StoreCategory | string | null;
  address: string | null;
  phone: string | null;
  opening_hours: OpeningHours | null;
  rating: number | null;
  review_count: number;
  photo_count: number;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  has_website: boolean;
  area: string | null;
  source: StoreSource | string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** 正規化関数の出力（id/timestamp はDB側で採番するため持たない） */
export type NormalizedStore = Omit<
  Store,
  "id" | "created_at" | "updated_at" | "tenant_id"
>;

// ------------------------------------------------------------
// leads
// ------------------------------------------------------------
export interface Lead {
  id: string;
  store_id: string;
  priority_rank: PriorityRank | null;
  score: number | null;
  reasons: string[] | null;
  sales_angle: string | null;
  risk_flags: string[] | null;
  status: LeadStatus;
  contact_method: string | null;
  last_contacted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// proposals
// ------------------------------------------------------------
export interface Proposal {
  id: string;
  store_id: string;
  summary: string | null;
  problems: string[] | null;
  opportunities: string[] | null;
  suggested_sections: string[] | null;
  sales_message: string | null;
  generated_markdown: string | null;
  created_at: string;
}

// ------------------------------------------------------------
// generated_sites
// ------------------------------------------------------------
export interface GeneratedSite {
  id: string;
  store_id: string;
  slug: string;
  theme_type: string | null;
  language: string;
  generated_json: SiteDocument | null;
  published_url: string | null;
  status: SiteStatus;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// activity_logs
// ------------------------------------------------------------
export type ActivityEventType =
  | "store.ingested"
  | "lead.scored"
  | "proposal.generated"
  | "site.generated"
  | "lead.note_updated"
  | "lead.status_updated";

export interface ActivityLog {
  id: string;
  store_id: string | null;
  event_type: ActivityEventType | string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ------------------------------------------------------------
// 仮デモサイトの JSON schema（generated_json の中身）
//   site/schema.ts に Zod スキーマも用意（実体はこの型と一致）
// ------------------------------------------------------------
export interface SiteSection {
  type:
    | "hero"
    | "about"
    | "menu"
    | "access"
    | "faq"
    | "contact"
    | "gallery"
    | "reviews";
  heading: string;
  body?: string;
  items?: Array<{ title: string; description?: string; meta?: string }>;
  faqs?: Array<{ q: string; a: string }>;
  /** 仮説に基づく内容であることを示す（実在しない情報の捏造防止） */
  isHypothesis?: boolean;
}

export interface SitePage {
  slug: string; // "", "about", "menu", "access", "faq", "contact"
  title: string;
  seo: { title: string; description: string };
  sections: SiteSection[];
}

export interface SiteDocument {
  storeName: string;
  themeType: string;
  language: string;
  brandColor: string;
  pages: SitePage[];
  /** 写真不足時のフォールバックを使ったか */
  usedPhotoFallback: boolean;
  /** 生成に使った主要シグナルのメモ（監査用） */
  generationNotes: string[];
}
