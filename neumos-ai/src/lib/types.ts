/**
 * Neumos AI v1 の型契約（単一定義）。
 *
 * 設計方針:
 *  - Neumos AIは「HTMLを組み立てるだけのAI」ではなく、店舗の強み分析→集客課題整理→
 *    ターゲット定義→サイトコンセプト→ページ構成→SEO→本文生成という
 *    マーケティング思考のパイプラインを経てコンテンツを出力する。
 *  - `generationType` を切り替えることで同じ `StoreBrief` から複数種別のコンテンツへ
 *    拡張できるように設計する（v1実装は website のみ）。
 */

/** 生成コンテンツ種別。v1は "website" のみ実装、他は将来拡張用に型だけ用意する。 */
export type GenerationType =
  | "website"
  | "landing_page"
  | "instagram_post"
  | "google_business_improvement"
  | "blog_post"
  | "faq"
  | "seo_content"
  | "copywriting";

export const IMPLEMENTED_GENERATION_TYPES: readonly GenerationType[] = ["website"];

export function isGenerationTypeImplemented(type: GenerationType): boolean {
  return IMPLEMENTED_GENERATION_TYPES.includes(type);
}

/**
 * 店舗情報・AI診断・営業提案の受け渡し契約（外部から渡される入力）。
 * AI集客支援MVP側の `NeumosBrief`（generationType を除いた核）と同一形状。
 */
export interface StoreBrief {
  storeName: string;
  industry: string;
  area: string;
  targetCustomer: string;
  mainProblem: string;
  salesAngle: string;
  websiteGoal: string;
  siteConcept: string;
  recommendedPages: string[];
  seoKeywords: string[];
  tone: string;
  offer: string;
  /**
   * Google ビジネスプロフィール等から取得できた実データ（任意）。
   * MVP側がGoogle Placesから取得済みの場合のみ渡される。存在する項目のみ
   * Website Rendererが店舗情報カード・ギャラリー等に反映し、無い項目は
   * 表示しない（捏造しないため、値が無ければ非表示にする設計）。
   */
  realData?: StoreRealData;
}

/** Google ビジネスプロフィール等から取得できた実データ。全項目任意。 */
export interface StoreRealData {
  address?: string;
  phone?: string;
  /** 曜日ごとの営業時間表記（例: "月: 10:00–19:00"）。取得元の表記をそのまま使う。 */
  openingHours?: string[];
  /** 定休日の説明（例: "水曜定休"）。取得できなければ省略する。 */
  closedDays?: string;
  instagramUrl?: string;
  /** Google の評価（0〜5）。 */
  googleRating?: number;
  googleReviewCount?: number;
  /** 実写真のURL（表示可能な直リンク）。存在する分だけGallery/Aboutで使う。 */
  photoUrls?: string[];
}

export interface GenerateRequest {
  generationType: GenerationType;
  brief: StoreBrief;
}

/** 生成パイプラインの状態。v1は同期生成のため queued/generating は実質一瞬で通過する。 */
export type GenerateStatus = "queued" | "generating" | "preview" | "published" | "failed";

/**
 * セクションの意味的分類。Website Rendererはこの `kind` を見て
 * About / Service / Feature のどのコンポーネントに描画するかを決める。
 * 分類できない構成ページは "other" として汎用セクション扱いにする。
 */
export type SectionKind = "about" | "service" | "feature" | "other";

/** ホームページの1セクション（構成案 + 生成本文）。 */
export interface WebsiteSection {
  id: string;
  kind: SectionKind;
  heading: string;
  body: string;
}

export interface WebsiteCta {
  headline: string;
  body: string;
  buttonLabel: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * ギャラリーの1枠。実写真は無い前提のため、Website Rendererは
 * `caption`/`altText` を使ってデザイン性のあるプレースホルダー（グラデーション+文言）を描画する。
 */
export interface GalleryItem {
  id: string;
  caption: string;
  altText: string;
}

/** アクセス（地図・行き方）情報。Google Maps埋め込み用のクエリのみ保持し、APIキーは不要。 */
export interface AccessInfo {
  areaLabel: string;
  addressHint: string;
  mapQuery: string;
}

/**
 * マーケティング思考の中間成果物（戦略部分）。
 * 最終コンテンツを生成する前段として保持し、レスポンスにも含めて説明可能性を担保する。
 */
export interface StrategyAnalysis {
  strengths: string[];
  challenges: string[];
  targetPersona: string;
  differentiators: string[];
}

/**
 * generationType = "website" の生成物。
 * 仕様上のフィールド名・構造を固定契約とする。
 */
export interface GeneratedWebsiteContents {
  concept: string;
  heroTitle: string;
  heroSubtitle: string;
  sections: WebsiteSection[];
  gallery: GalleryItem[];
  access: AccessInfo;
  contactMethods: string[];
  cta: WebsiteCta;
  seoTitle: string;
  metaDescription: string;
  faq: FaqItem[];
  instagramCaption: string;
  googleBusinessImprovement: string[];
  /** どのような戦略思考を経て生成したかの記録（説明可能性のため）。 */
  strategy: StrategyAnalysis;
}

/** generationType ごとの生成物マップ。将来の拡張はここへ型を追加していく。 */
export interface GeneratedContentsMap {
  website: GeneratedWebsiteContents;
  landing_page: never;
  instagram_post: never;
  google_business_improvement: never;
  blog_post: never;
  faq: never;
  seo_content: never;
  copywriting: never;
}

export type GeneratedContents = GeneratedContentsMap[GenerationType];

export interface GenerateResponse {
  requestId: string;
  status: GenerateStatus;
  previewUrl: string;
  publishedUrl: string | null;
  generatedContents: GeneratedWebsiteContents;
}

/** 生成方式。説明可能性のため常にレスポンス外にログとして残す。 */
export type GenerationMethod = "rule" | "rule+llm";

export interface StoredGenerationRecord {
  requestId: string;
  generationType: GenerationType;
  brief: StoreBrief;
  status: GenerateStatus;
  method: GenerationMethod;
  generatedContents: GeneratedWebsiteContents;
  previewHtml: string;
  previewUrl: string;
  publishedUrl: string | null;
  createdAt: string;
}
