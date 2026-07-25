/**
 * Brand Director（新規レイヤー）の型契約。
 *
 * 既存の「コピー生成」（engine/website.ts が rule/LLM で GeneratedWebsiteContents を
 * 作る経路）とは別軸の、新しい追加レイヤー。店舗データ・実データ・写真から
 * 「その店舗専用のブランド方針（BrandPlan）」を決定する。
 *
 * 重要: このモジュールは今回まだどの生成経路からも呼ばれない
 * （generate.ts / engine/website.ts / WebsiteRendererV2 は無改修）。
 * v2レイアウトエンジンへの実配線は将来のフェーズで行う。
 */

/** ブランドの性格（デザイントーンの大分類）。 */
export type BrandArchetype =
  | "artisan"
  | "modern-minimal"
  | "warm-hospitality"
  | "luxury-quiet"
  | "energetic-casual"
  | "heritage-traditional"
  | "wellness-calm";

export type PhotoRole = "hero" | "story" | "menu" | "gallery" | "access" | "reject";

/** 判断1件ごとの根拠。事実(brief/realData/photo)と推測(inference)を必ず分離する。 */
export interface EvidenceItem {
  /** この根拠がどのBrandPlanフィールドの判断を支えるか（例: "moodKeywords"）。 */
  field: string;
  basis: "brief" | "realData" | "photo" | "inference";
  /** 具体的な根拠（briefの該当箇所の引用や要約など）。 */
  detail: string;
}

export interface PhotoAssignment {
  photoUrl: string;
  role: PhotoRole;
  /** 0〜100。写真そのものの質・使いやすさの評価。 */
  qualityScore: number;
  /** role="reject"の場合の理由。それ以外はnull。 */
  rejectionReason: string | null;
}

export interface BrandPlan {
  brandArchetype: BrandArchetype;
  /** classifyIndustry()互換のカテゴリ文字列。判定できなければ"general"。 */
  industry: string;
  /** briefから抽出したターゲット層（最大3件）。 */
  audiences: string[];
  /** 主要な来店動機を表す1文。 */
  customerIntent: string;
  /** 3〜6件のムードキーワード。 */
  moodKeywords: string[];
  /** 事実に基づく価値提案（1文）。 */
  valueProposition: string;
  visualDirection: {
    paletteHint: "warm" | "cool" | "neutral" | "high-contrast";
    typographyTone: "editorial-serif" | "clean-sans" | "bold-display";
    photoTreatment: "full-bleed" | "framed" | "mixed";
  };
  copyDirection: {
    tone: string;
    emphasis: "atmosphere" | "product" | "trust" | "urgency";
  };
  /** 既存v2の設計（immersive/editorial/direct Hero）に対応。 */
  layoutVariant: "immersive" | "editorial" | "direct";
  photoAssignments: PhotoAssignment[];
  ctaStrategy: {
    placement: "hero" | "after-story" | "end-only";
    urgency: "low" | "medium" | "high";
  };
  /** 0〜1。BrandPlan全体に対するモデルの確信度。 */
  confidence: number;
  evidence: EvidenceItem[];
}

/** Phase3: 写真1枚ごとのVision分析結果（BrandPlan.photoAssignmentsへ集約される前段）。 */
export interface PhotoAnalysis {
  photoUrl: string;
  subject: string;
  brightness: "bright" | "balanced" | "dark";
  orientation: "portrait" | "landscape" | "square";
  dominantMood: string;
  containsPeople: boolean;
  containsFoodOrProduct: boolean;
  containsExterior: boolean;
  containsInterior: boolean;
  textSafeArea: "top" | "bottom" | "left" | "right" | "center" | "none";
  recommendedRole: PhotoRole;
  /** 0〜100。 */
  qualityScore: number;
  rejectionReason: string | null;
}

/** Phase5: 店舗単位のOpenAI利用量記録（型のみ。永続化は未接続）。 */
export interface BrandDirectorUsage {
  requestId: string;
  provider: "rule" | "openai";
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  success: boolean;
  fallbackReason: string | null;
  retryCount: number;
  photosAnalyzed: number;
  /** 概算コスト（USD）。モデル単価が不明な場合はnull。 */
  estimatedCostUsd: number | null;
}

export interface BrandDirectionResult {
  plan: BrandPlan;
  usage: BrandDirectorUsage;
}

export interface BrandDirectionInput {
  requestId: string;
  brief: import("@/lib/types").StoreBrief;
}
