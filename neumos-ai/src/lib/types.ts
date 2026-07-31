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
  /**
   * Google レビューの本文（実データが取得できた場合のみ）。
   * 現時点ではMVP側（AI集客支援MVP、疎結合な別サービス）にGoogle Places APIから
   * レビュー本文を取得してこのフィールドへ渡す処理がまだ無いため、型だけ用意して
   * おき、値が来た場合にのみ表示する（無ければ捏造せず非表示にする設計は他項目と同じ）。
   */
  reviews?: StoreReview[];
  /**
   * 実際のメニュー品目（店舗が入力・確認した実データの場合のみ）。
   * 現時点ではMVP側にこの情報を渡す入力経路がまだ無いため、値が来た場合にのみ
   * 商品名・価格として表示する（無ければMenuV2は生成コピーによる説明のみに留め、
   * 架空の商品名・価格は一切表示しない）。
   */
  menuItems?: RealMenuItem[];
  /** 店舗公式サイトURL（実データがある場合のみ。MVP側store.website_url由来）。 */
  websiteUrl?: string;
  /**
   * Google Places由来の正式なGoogle Maps URL（MVP側raw_payload.googleMapsUriそのもの）。
   * 存在する場合、Google Mapsリンクはこの値を最優先で使い、テキスト検索URLへ
   * 作り直さない（`engine/real-data-links.ts`の`resolveGoogleMapsUrl`参照）。
   */
  googleMapsUrl?: string;
  /** 実店舗写真とは別枠で、明示的なAI表示とともに使う補助画像。 */
  supplementalImages?: SupplementalImage[];
}

export interface SupplementalImage {
  url: string;
  source: "openai-generated";
  role: "atmosphere";
  altText: string;
  disclosure: "AI生成イメージ（実際の店舗写真ではありません）";
  promptVersion: "cafe-atmosphere-v1";
}

/** Google レビュー1件（本文のみ必須。評価者名・個別評価は取得できた場合のみ）。 */
export interface StoreReview {
  text: string;
  authorName?: string;
  rating?: number;
}

/**
 * 実際のメニュー品目1件（店舗が入力・確認した実データの場合のみ渡される）。
 * `brief.offer`（AIが文章生成に使う自由記述の「売り」の説明）とは別物であり、
 * `offer`からメニュー品目・価格を自動生成することはしない（捏造防止）。
 * priceは表記ゆれ（"500円〜"等）をそのまま尊重するため文字列として保持する。
 */
export interface RealMenuItem {
  name: string;
  price?: string;
  description?: string;
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
  /**
   * 実際に機能するリンク先（tel:.../https://instagram.com/...等、または
   * ページ内アンカー"#contact"）。生成方式に依らず`applyRealDataLinks`が
   * 最終的にrealDataとの整合性を保って上書きするため、ここに来る値を
   * 信頼してそのまま描画してよい。
   */
  href: string;
}

/**
 * Contact セクションの補助的な連絡手段1件。
 * hrefが無い項目は「リンク先データが存在しない」ことを意味し、Website
 * Rendererはクリック不可のプレーンテキストとして表示する（クリックしても
 * 何も起きないボタンに見せないこと）。
 */
export interface ContactMethod {
  label: string;
  href?: string;
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
  contactMethods: ContactMethod[];
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
  /**
   * v2デザインエンジン（カフェ業態専用）が使うBrandPlan。生成時（performGeneration）に
   * 一度だけ作成してここへ保存し、v2プレビューを開く・更新するたびにOpenAIを
   * 再実行しないようにする。カフェ以外の業種・生成時点でBrand Directorが
   * 使えなかった場合・過去に生成された旧レコードはundefined（v2はBrandPlan無しの
   * 従来表示へ安全にフォールバックする）。
   */
  brandPlan?: import("@/lib/brand-director/types").BrandPlan;
}
