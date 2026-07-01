/**
 * ドメイン型定義（DBスキーマと1:1対応）
 * - DBの行型(Row)とアプリ内ドメイン型を一致させ、Repository層で変換コストを最小化する。
 * - 文字列リテラル型で取りうる値を明示し、説明可能性・型安全性を高める。
 */

/** 営業優先度ランク */
export type PriorityRank = "A" | "B" | "C";

/** 店舗データの取得元 */
export type StoreSource = "google_places" | "apify" | "csv" | "manual";

/**
 * 営業ステータス（営業ファネル）。
 * 未対応 → DM送信 → 電話 → 商談 → 成約 / 失注
 */
export type LeadStatus =
  | "todo" // 未対応
  | "dm_sent" // DM送信
  | "called" // 電話
  | "negotiating" // 商談
  | "won" // 成約
  | "lost"; // 失注

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
// ノイモスAI連携（店舗のWeb集客コンテンツ生成AI）
//   営業支援 → 受注 → コンテンツ生成 → 公開 の受け渡し契約。
//   ここ（Brief）を安定させることで、生成エンジンを疎結合に差し替え可能にする。
//   同じ Brief から generationType を変えて複数種類のコンテンツを生成できる。
// ------------------------------------------------------------

/**
 * 生成コンテンツ種別。
 * まず website（ホームページ）を実装し、以降を同じ Brief から拡張する。
 */
export type GenerationType =
  | "website" // ホームページ
  | "landing_page" // ランディングページ
  | "blog_post" // ブログ記事
  | "instagram_post" // Instagram投稿
  | "gbp_improvement" // Googleビジネスプロフィール改善案
  | "faq" // FAQ
  | "catchcopy" // キャッチコピー
  | "seo_content"; // SEOコンテンツ

/**
 * コンテンツ生成ブリーフ（ノイモスAIへ渡す入力データ契約）。
 * - 店舗情報・提案内容・業種・強み・ターゲット等の“共有コンテキスト”を1つに集約。
 * - generationType で生成対象を選ぶ。同じ共有コンテキストから複数種別を生成可能。
 * - typeOptions に種別固有の指定（将来拡張）を持たせ、コア構造を汚さない。
 * - schemaVersion でバージョン管理し後方互換を保つ。
 * - 実データと仮説を分離（assumptions に仮説を明示）。捏造を防ぐ。
 */
export interface ContentGenerationBrief {
  schemaVersion: string; // 例: "1.0"
  /** 生成対象コンテンツ種別 */
  generationType: GenerationType;
  store: {
    storeId: string;
    name: string;
    category: StoreCategory | string; // 正規化カテゴリ
    categoryLabel: string; // 日本語表示名
    area: string | null;
    address: string | null;
    phone: string | null;
    openingHours: string[] | null;
  };
  online: {
    hasWebsite: boolean;
    websiteUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
  };
  metrics: {
    rating: number | null;
    reviewCount: number;
    photoCount: number;
    photoRefs: string[]; // Places写真リソース名（あれば）
  };
  /** 提案・分析から抽出した訴求素材 */
  strengths: string[]; // 強み
  improvements: string[]; // 改善点（機会損失）
  expectedEffects: string[]; // 期待効果（仮説）
  target: string; // 想定顧客層
  salesAngle: string | null; // 営業切り口
  priority: { rank: PriorityRank; score: number } | null;
  suggestedSections: string[]; // 推奨ページ構成
  theme: { suggestedType: string; brandColorHint: string }; // 業種別テーマ提案
  seo: { titleHint: string; descriptionHint: string };
  reviewSummary: string | null;
  assumptions: string[]; // 仮説（要確認事項）
  /** 生成AIが参照できるよう、生成済み提案書Markdownを同梱（任意） */
  sourceProposalMarkdown: string | null;
  /** 種別固有の追加指定（将来拡張。例: blogのテーマ, LPのCVゴール, IG投稿数など） */
  typeOptions?: Record<string, unknown>;
}

/** @deprecated 旧名。ContentGenerationBrief を使用（後方互換のため残置）。 */
export type SiteGenerationBrief = ContentGenerationBrief;

/** 生成パイプラインの状態 */
export type SiteGenRequestStatus =
  | "draft" // ブリーフ作成のみ（ノイモスAI未接続/受注前）
  | "requested" // ノイモスAIへ送信済み
  | "queued" // 生成待ち
  | "generating" // 生成中
  | "preview" // プレビュー可能
  | "published" // 公開済み
  | "failed"; // 失敗

/**
 * コンテンツ生成リクエスト（受注→生成→公開の記録）。
 * - brief を保持し、ノイモスAI側の外部ID/公開URLを追跡する。
 */
export interface SiteGenerationRequest {
  id: string;
  store_id: string;
  provider: string; // "neumos" 等
  generation_type: GenerationType; // 生成対象コンテンツ種別
  status: SiteGenRequestStatus;
  brief: ContentGenerationBrief | null;
  external_id: string | null; // ノイモスAI側ジョブID
  preview_url: string | null;
  published_url: string | null;
  error: string | null;
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
  | "lead.status_updated"
  | "outreach.generated"
  | "site.generation_requested";

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
