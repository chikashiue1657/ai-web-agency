/**
 * BrandPlan / PhotoAnalysis のスキーマ。
 *
 * 2つの表現を持つ:
 *  - zodスキーマ: OpenAIから返ってきたJSON（またはrule-providerが組み立てたJSON）を
 *    アプリ側で最終検証する（既存のGeneratedWebsiteContentsSchemaと同じ役割）。
 *  - JSON Schema（プレーンオブジェクト）: OpenAI Responses APIの
 *    `text.format = { type: "json_schema", strict: true, schema: ... }` へ
 *    そのまま渡すためのもの。zodから自動生成せず手書きにしているのは、
 *    strict modeが要求する `additionalProperties: false` と
 *    「全プロパティをrequiredにする」という制約を、意図が読み取れる形で
 *    明示したいため。
 *
 * 重要: 数値・配列の上下限は zod と JSON Schema の両方に**同じ値**を書く。
 * 自動生成ライブラリは導入していない（既存方針の軽量さを優先）ため、
 * 2箇所の値がずれていないことは `tests/brand-director-schema-consistency.test.ts`
 * が毎回突き合わせて検証する（zodの内部表現(_def)を読むテストのため、
 * zodのメジャーバージョンを上げた際はこのテストの実装も見直すこと）。
 */
import { z } from "zod";

const brandArchetypeEnum = [
  "artisan",
  "modern-minimal",
  "warm-hospitality",
  "luxury-quiet",
  "energetic-casual",
  "heritage-traditional",
  "wellness-calm",
] as const;

const photoRoleEnum = ["hero", "story", "menu", "gallery", "access", "reject"] as const;

/** 境界値の単一の真実源（zod・JSON Schema双方がここを参照する）。 */
export const BRAND_PLAN_BOUNDS = {
  audiences: { min: 1, max: 3 },
  moodKeywords: { min: 3, max: 6 },
  photoAssignments: { max: 6 },
  evidence: { min: 1, max: 12 },
  confidence: { min: 0, max: 1 },
  /** qualityScoreは0〜100（confidenceの0〜1とスケールを分けている）。 */
  qualityScore: { min: 0, max: 100 },
} as const;

export const EvidenceItemSchema = z.object({
  field: z.string().min(1),
  basis: z.enum(["brief", "realData", "photo", "inference"]),
  detail: z.string().min(1),
});

export const PhotoAssignmentSchema = z.object({
  photoUrl: z.string().min(1),
  role: z.enum(photoRoleEnum),
  qualityScore: z.number().min(BRAND_PLAN_BOUNDS.qualityScore.min).max(BRAND_PLAN_BOUNDS.qualityScore.max),
  rejectionReason: z.string().nullable(),
});

export const BrandPlanSchema = z.object({
  brandArchetype: z.enum(brandArchetypeEnum),
  industry: z.string().min(1),
  audiences: z.array(z.string().min(1)).min(BRAND_PLAN_BOUNDS.audiences.min).max(BRAND_PLAN_BOUNDS.audiences.max),
  customerIntent: z.string().min(1),
  moodKeywords: z
    .array(z.string().min(1))
    .min(BRAND_PLAN_BOUNDS.moodKeywords.min)
    .max(BRAND_PLAN_BOUNDS.moodKeywords.max),
  valueProposition: z.string().min(1),
  visualDirection: z.object({
    paletteHint: z.enum(["warm", "cool", "neutral", "high-contrast"]),
    typographyTone: z.enum(["editorial-serif", "clean-sans", "bold-display"]),
    photoTreatment: z.enum(["full-bleed", "framed", "mixed"]),
  }),
  copyDirection: z.object({
    tone: z.string().min(1),
    emphasis: z.enum(["atmosphere", "product", "trust", "urgency"]),
  }),
  layoutVariant: z.enum(["immersive", "editorial", "direct"]),
  photoAssignments: z.array(PhotoAssignmentSchema).max(BRAND_PLAN_BOUNDS.photoAssignments.max),
  ctaStrategy: z.object({
    placement: z.enum(["hero", "after-story", "end-only"]),
    urgency: z.enum(["low", "medium", "high"]),
  }),
  confidence: z.number().min(BRAND_PLAN_BOUNDS.confidence.min).max(BRAND_PLAN_BOUNDS.confidence.max),
  evidence: z.array(EvidenceItemSchema).min(BRAND_PLAN_BOUNDS.evidence.min).max(BRAND_PLAN_BOUNDS.evidence.max),
});

export const PhotoAnalysisSchema = z.object({
  photoUrl: z.string().min(1),
  subject: z.string().min(1),
  brightness: z.enum(["bright", "balanced", "dark"]),
  orientation: z.enum(["portrait", "landscape", "square"]),
  dominantMood: z.string().min(1),
  containsPeople: z.boolean(),
  containsFoodOrProduct: z.boolean(),
  containsExterior: z.boolean(),
  containsInterior: z.boolean(),
  textSafeArea: z.enum(["top", "bottom", "left", "right", "center", "none"]),
  recommendedRole: z.enum(photoRoleEnum),
  qualityScore: z.number().min(BRAND_PLAN_BOUNDS.qualityScore.min).max(BRAND_PLAN_BOUNDS.qualityScore.max),
  rejectionReason: z.string().nullable(),
});

/** OpenAI Responses API の Structured Outputs (strict mode) へ渡すJSON Schema。 */
export const BRAND_PLAN_JSON_SCHEMA = {
  name: "brand_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "brandArchetype",
      "industry",
      "audiences",
      "customerIntent",
      "moodKeywords",
      "valueProposition",
      "visualDirection",
      "copyDirection",
      "layoutVariant",
      "photoAssignments",
      "ctaStrategy",
      "confidence",
      "evidence",
    ],
    properties: {
      brandArchetype: { type: "string", enum: brandArchetypeEnum },
      industry: { type: "string" },
      audiences: {
        type: "array",
        items: { type: "string" },
        minItems: BRAND_PLAN_BOUNDS.audiences.min,
        maxItems: BRAND_PLAN_BOUNDS.audiences.max,
      },
      customerIntent: { type: "string" },
      moodKeywords: {
        type: "array",
        items: { type: "string" },
        minItems: BRAND_PLAN_BOUNDS.moodKeywords.min,
        maxItems: BRAND_PLAN_BOUNDS.moodKeywords.max,
      },
      valueProposition: { type: "string" },
      visualDirection: {
        type: "object",
        additionalProperties: false,
        required: ["paletteHint", "typographyTone", "photoTreatment"],
        properties: {
          paletteHint: { type: "string", enum: ["warm", "cool", "neutral", "high-contrast"] },
          typographyTone: { type: "string", enum: ["editorial-serif", "clean-sans", "bold-display"] },
          photoTreatment: { type: "string", enum: ["full-bleed", "framed", "mixed"] },
        },
      },
      copyDirection: {
        type: "object",
        additionalProperties: false,
        required: ["tone", "emphasis"],
        properties: {
          tone: { type: "string" },
          emphasis: { type: "string", enum: ["atmosphere", "product", "trust", "urgency"] },
        },
      },
      layoutVariant: { type: "string", enum: ["immersive", "editorial", "direct"] },
      photoAssignments: {
        type: "array",
        maxItems: BRAND_PLAN_BOUNDS.photoAssignments.max,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["photoUrl", "role", "qualityScore", "rejectionReason"],
          properties: {
            photoUrl: { type: "string" },
            role: { type: "string", enum: photoRoleEnum },
            qualityScore: {
              type: "number",
              minimum: BRAND_PLAN_BOUNDS.qualityScore.min,
              maximum: BRAND_PLAN_BOUNDS.qualityScore.max,
            },
            rejectionReason: { type: ["string", "null"] },
          },
        },
      },
      ctaStrategy: {
        type: "object",
        additionalProperties: false,
        required: ["placement", "urgency"],
        properties: {
          placement: { type: "string", enum: ["hero", "after-story", "end-only"] },
          urgency: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
      confidence: {
        type: "number",
        minimum: BRAND_PLAN_BOUNDS.confidence.min,
        maximum: BRAND_PLAN_BOUNDS.confidence.max,
      },
      evidence: {
        type: "array",
        minItems: BRAND_PLAN_BOUNDS.evidence.min,
        maxItems: BRAND_PLAN_BOUNDS.evidence.max,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["field", "basis", "detail"],
          properties: {
            field: { type: "string" },
            basis: { type: "string", enum: ["brief", "realData", "photo", "inference"] },
            detail: { type: "string" },
          },
        },
      },
    },
  },
} as const;

/** Vision分析（写真1枚あたり）用のJSON Schema。 */
export const PHOTO_ANALYSIS_JSON_SCHEMA = {
  name: "photo_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "photoUrl",
      "subject",
      "brightness",
      "orientation",
      "dominantMood",
      "containsPeople",
      "containsFoodOrProduct",
      "containsExterior",
      "containsInterior",
      "textSafeArea",
      "recommendedRole",
      "qualityScore",
      "rejectionReason",
    ],
    properties: {
      photoUrl: { type: "string" },
      subject: { type: "string" },
      brightness: { type: "string", enum: ["bright", "balanced", "dark"] },
      orientation: { type: "string", enum: ["portrait", "landscape", "square"] },
      dominantMood: { type: "string" },
      containsPeople: { type: "boolean" },
      containsFoodOrProduct: { type: "boolean" },
      containsExterior: { type: "boolean" },
      containsInterior: { type: "boolean" },
      textSafeArea: { type: "string", enum: ["top", "bottom", "left", "right", "center", "none"] },
      recommendedRole: { type: "string", enum: photoRoleEnum },
      qualityScore: {
        type: "number",
        minimum: BRAND_PLAN_BOUNDS.qualityScore.min,
        maximum: BRAND_PLAN_BOUNDS.qualityScore.max,
      },
      rejectionReason: { type: ["string", "null"] },
    },
  },
} as const;
