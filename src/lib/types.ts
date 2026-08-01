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

/** 店舗担当者が確認・入力した実メニュー。AIによる推測値は保存しない。 */
export interface RealMenuItem {
  /** 管理画面内で並び替え・写真差し替えに使う安定ID。Neumosへは送らない。 */
  id?: string;
  name: string;
  price?: string;
  description?: string;
  /** Supabase Storageの公開URL。 */
  imageUrl?: string;
  /** Storage内の削除・差し替え用パス。Neumosへは送らない。 */
  imagePath?: string;
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
 * 生成コンテンツ種別（固定設計）。
 * まず website を実装し、同じ NeumosBrief から他種別へ拡張する。
 */
export type GenerationType =
  | "website" // ホームページ
  | "landing_page" // ランディングページ
  | "instagram_post" // Instagram投稿
  | "google_business_improvement" // Googleビジネスプロフィール改善案
  | "blog_post" // ブログ記事
  | "faq" // FAQ
  | "seo_content" // SEOコンテンツ
  | "copywriting"; // キャッチコピー/コピーライティング

/**
 * ノイモスAIへ渡す最終ブリーフ（外部連携JSON契約・固定）。
 * StoreStrategy から生成し、generationType を差し替えて複数種別に対応する。
 */
export interface NeumosBrief {
  storeName: string;
  industry: string; // 業種（日本語ラベル）
  area: string;
  targetCustomer: string;
  mainProblem: string; // 最重要の集客課題
  salesAngle: string;
  websiteGoal: string; // サイトのゴール（予約/来店/問い合わせ等）
  siteConcept: string; // サイトコンセプト
  recommendedPages: string[];
  seoKeywords: string[];
  tone: string; // トーン&マナー
  offer: string; // 提案オファー
  generationType: GenerationType;
  /**
   * Google ビジネスプロフィール等から取得できた実データ（任意）。
   * storeにGoogle Places由来のデータがある場合のみ`buildStoreRealData`で埋める。
   * Neumos AI側は存在する項目のみ店舗情報カード・ギャラリーに反映し、
   * 無い項目は表示しない（捏造防止のため、値が無ければ省略する設計）。
   */
  realData?: StoreRealData;
}

/** Google ビジネスプロフィール等から取得できた実データ。全項目任意。 */
export interface StoreRealData {
  address?: string;
  phone?: string;
  /** 曜日ごとの営業時間表記（例: "月曜日: 10:00~19:00"）。取得元の表記をそのまま使う。 */
  openingHours?: string[];
  closedDays?: string;
  instagramUrl?: string;
  /** Google の評価（0〜5）。 */
  googleRating?: number;
  googleReviewCount?: number;
  /** 実写真のURL（表示可能な直リンク）。存在する分だけGallery/Aboutで使う。 */
  photoUrls?: string[];
  /** 店舗公式サイトURL（store.website_url由来。SNS/ポータルは既にnormalize/url.tsで除外済み）。 */
  websiteUrl?: string;
  /**
   * Google Places由来の正式なGoogle Maps URL（raw_payload.googleMapsUriそのもの）。
   * 存在する場合、Neumos AI側はテキスト検索URLへ作り直さずこの値をそのまま使う。
   */
  googleMapsUrl?: string;
  /** 管理画面で確認・入力された実在メニューのみ。 */
  menuItems?: RealMenuItem[];
}

/** generationType を除いた再利用可能なブリーフ核（StoreStrategy が保持）。 */
export type NeumosBriefBase = Omit<NeumosBrief, "generationType">;

/**
 * 店舗戦略（Thinking Engine の診断結果）。
 * 店舗情報からAIで導く「強み/弱み/課題/ターゲット/受注確率/営業切り口/提案」等。
 * 実データと仮説を分離し捏造を防ぐ（仮説は本文に「（仮説）」で明示）。
 */
export interface StoreStrategy {
  id: string;
  storeId: string;
  // --- item2 で指定された中核フィールド ---
  strengths: string[];
  weaknesses: string[];
  targetCustomer: string;
  marketingProblems: string[];
  recommendedOffer: string;
  salesAngle: string;
  websiteConcept: string;
  seoKeywords: string[];
  generationBrief: NeumosBriefBase; // ノイモスAIへの受け渡し核
  confidenceScore: number; // 受注確率(0-100)
  // --- 診断の追加項目（AI診断UI用） ---
  websiteNecessity: string; // HPの必要性
  snsImprovements: string[]; // SNS改善点
  googleBusinessImprovements: string[]; // Googleビジネス改善点
  differentiation: string; // 競合との差別化
  recommendedPages: string[]; // おすすめHP構成
  priorityRationale: string; // なぜA/B/Cか
  websiteGoal: string;
  tone: string;
  method: "rule" | "rule+llm"; // 説明可能性: 生成方式
  created_at: string;
  updated_at: string;
}

/** 生成パイプラインの状態 */
export type ContentGenStatus =
  | "draft" // ブリーフ作成のみ（ノイモスAI未接続/受注前）
  | "requested" // ノイモスAIへ送信済み
  | "queued" // 生成待ち
  | "generating" // 生成中
  | "preview" // プレビュー可能
  | "published" // 公開済み
  | "failed"; // 失敗

/** @deprecated 旧名。ContentGenStatus を使用。 */
export type SiteGenRequestStatus = ContentGenStatus;

/**
 * ノイモスAIが生成した個々のコンテンツ（ページ/セクション/コピー等）。
 * 種別により内容が異なるため緩く保持する。
 */
export interface GeneratedContent {
  type?: string; // "page" | "section" | "copy" | "post" 等
  title?: string;
  url?: string; // 個別成果物のURL（あれば）
  body?: string; // 本文/HTML/Markdown 等
  meta?: Record<string, unknown>;
}

/**
 * コンテンツ生成リクエスト（受注→生成→公開の記録）。
 * - NeumosBrief を保持し、ノイモスAI側の requestId(=external_id)/状態/URL/生成物を追跡する。
 */
export interface ContentGenerationRequest {
  id: string;
  store_id: string;
  provider: string; // "neumos" 等
  generation_type: GenerationType;
  status: ContentGenStatus;
  brief: NeumosBrief | null;
  external_id: string | null; // ノイモスAI側 requestId
  preview_url: string | null;
  published_url: string | null;
  generated_contents: GeneratedContent[] | null; // 生成物
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated 旧名。ContentGenerationRequest を使用。 */
export type SiteGenerationRequest = ContentGenerationRequest;

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
  | "strategy.diagnosed"
  | "content.generation_requested";

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
