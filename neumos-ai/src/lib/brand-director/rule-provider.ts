/**
 * Brand DirectorのLLM不要フォールバック実装。
 *
 * OPENAI_API_KEYが未設定・OpenAI呼び出しが失敗した場合に必ずここへ落ちる。
 * briefに実在するフィールドだけから決定論的に組み立てるため、事実の捏造が
 * 起こりようがない（推測が必要な項目は confidence を低く申告する）。
 */
import { classifyIndustry, type IndustryCategory } from "@/lib/engine/industry";
import type { StoreBrief } from "@/lib/types";
import type { BrandDirectionProvider } from "./provider";
import type { BrandDirectionInput, BrandDirectionResult, BrandPlan, EvidenceItem, PhotoAnalysis, PhotoAssignment } from "./types";
import { BRAND_PLAN_BOUNDS } from "./schema";

/** qualityScoreの中立値（写真を見て評価していないことを表す、0〜100スケールの中央値）。 */
const NEUTRAL_QUALITY_SCORE = 50;

function archetypeForIndustry(category: IndustryCategory): BrandPlan["brandArchetype"] {
  switch (category) {
    case "cafe":
      return "artisan";
    case "hair_salon":
      return "modern-minimal";
    case "spa":
      return "wellness-calm";
    case "izakaya":
      return "energetic-casual";
    case "hotel":
      return "luxury-quiet";
    default:
      return "warm-hospitality";
  }
}

function layoutForIndustry(category: IndustryCategory): BrandPlan["layoutVariant"] {
  switch (category) {
    case "spa":
    case "hotel":
      return "immersive";
    case "hair_salon":
      return "editorial";
    default:
      return "direct";
  }
}

/** brief中の非空フィールドだけから、事実に基づくムードキーワード候補を作る（捏造しない）。 */
function safeMoodKeywords(brief: StoreBrief, category: string): string[] {
  const candidates = [brief.tone, brief.salesAngle, brief.offer, brief.websiteGoal, brief.siteConcept, category]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim());
  return Array.from(new Set(candidates)).slice(0, 6);
}

/** 写真が有る場合は先頭をhero、2枚目をstory、残りをgalleryへ（既存photo-strategy.tsと同じ位置ベース割当て）。 */
function positionalPhotoAssignments(photoUrls: string[]): PhotoAssignment[] {
  const deduped = Array.from(new Set(photoUrls)).slice(0, BRAND_PLAN_BOUNDS.photoAssignments.max);
  return deduped.map((photoUrl, i) => ({
    photoUrl,
    role: i === 0 ? "hero" : i === 1 ? "story" : "gallery",
    qualityScore: NEUTRAL_QUALITY_SCORE,
    rejectionReason: null,
  }));
}

export const ruleBrandDirectionProvider: BrandDirectionProvider = {
  name: "rule",

  async analyzeBrand(input: BrandDirectionInput, photoAnalyses?: PhotoAnalysis[]): Promise<BrandDirectionResult> {
    const start = Date.now();
    const { brief, requestId } = input;
    const category = classifyIndustry(brief.industry);
    const photoUrls = brief.realData?.photoUrls ?? [];

    const evidence: EvidenceItem[] = [
      { field: "industry", basis: "brief", detail: `brief.industry="${brief.industry}"を業種分類した結果` },
      { field: "audiences", basis: "brief", detail: `brief.targetCustomer="${brief.targetCustomer}"をそのまま使用` },
      { field: "customerIntent", basis: "brief", detail: `brief.mainProblem="${brief.mainProblem}"をそのまま使用` },
    ];
    if (photoAnalyses && photoAnalyses.length > 0) {
      evidence.push({
        field: "photoAssignments",
        basis: "photo",
        detail: `Vision分析済みの写真${photoAnalyses.length}件を根拠に割当て`,
      });
    } else if (photoUrls.length > 0) {
      evidence.push({
        field: "photoAssignments",
        basis: "realData",
        detail: `写真${photoUrls.length}件を位置ベース（Vision分析なし）で割当て`,
      });
    }

    const plan: BrandPlan = {
      brandArchetype: archetypeForIndustry(category),
      industry: category,
      audiences: [brief.targetCustomer].filter(Boolean),
      customerIntent: brief.mainProblem,
      moodKeywords: safeMoodKeywords(brief, category),
      valueProposition: brief.salesAngle,
      visualDirection: {
        paletteHint: "neutral",
        // cafeは既存v2デザインエンジン（theme-v2.ts）が既にfont-serifを採用済みのため、
        // ここで"clean-sans"を返すとBrand Director接続後にcafeサイトの書体が
        // 無条件で変わってしまう（実際にv2へ接続して初めて判明した不整合）。
        // v2が実在する見た目に合わせ、hotelと同じくeditorial-serifを既定にする。
        typographyTone: category === "hotel" || category === "cafe" ? "editorial-serif" : "clean-sans",
        photoTreatment: photoUrls.length > 0 ? "full-bleed" : "framed",
      },
      copyDirection: {
        tone: brief.tone,
        emphasis: "atmosphere",
      },
      layoutVariant: layoutForIndustry(category),
      photoAssignments: photoAnalyses && photoAnalyses.length > 0
        ? photoAnalyses.slice(0, BRAND_PLAN_BOUNDS.photoAssignments.max).map((p) => ({
            photoUrl: p.photoUrl,
            role: p.recommendedRole,
            qualityScore: p.qualityScore,
            rejectionReason: p.rejectionReason,
          }))
        : positionalPhotoAssignments(photoUrls),
      supplementalImageDirection: category === "cafe" ? {
        sourcePhotoUrl: photoAnalyses?.find((photo) => photo.recommendedRole !== "reject")?.photoUrl ?? null,
        storeStrength: brief.salesAngle,
        visitMotivation: brief.websiteGoal,
        commercialSubject: "coffee-craft",
        shotType: "ritual-detail",
        cameraAngle: "counter-height",
        composition: "asymmetric-editorial",
        lighting: "soft-window",
        sensoryCues: safeMoodKeywords(brief, category).slice(0, 4),
        truthBoundary: ["実在店舗の再現ではない", "ロゴ・商品名・内外装を作らない"],
        avoid: ["架空の店舗外観", "読める文字", "過剰に整った商品陳列", "広告的な豆の散乱"],
      } : null,
      ctaStrategy: {
        placement: category === "izakaya" || category === "cafe" ? "hero" : "end-only",
        urgency: category === "izakaya" ? "high" : "low",
      },
      // ルールベースは店舗ごとの個別判断をしていないため、確信度は常に控えめに申告する。
      confidence: 0.4,
      evidence,
    };

    return {
      plan,
      usage: {
        requestId,
        provider: "rule",
        model: null,
        inputTokens: null,
        outputTokens: null,
        durationMs: Date.now() - start,
        success: true,
        fallbackReason: null,
        retryCount: 0,
        photosAnalyzed: photoAnalyses?.length ?? 0,
        estimatedCostUsd: 0,
      },
    };
  },

  async analyzePhotos(photoUrls: string[]): Promise<PhotoAnalysis[]> {
    // Visionを使わないため、写真の中身については何も断定しない
    // （brightness/orientation等を推測で埋めると捏造になるため、
    // 「不明」であることが分かる中立値だけを返す）。
    return photoUrls.map((photoUrl) => ({
      photoUrl,
      subject: "unknown",
      brightness: "balanced",
      orientation: "landscape",
      dominantMood: "unknown",
      containsPeople: false,
      containsFoodOrProduct: false,
      containsExterior: false,
      containsInterior: false,
      textSafeArea: "none",
      recommendedRole: "gallery",
      qualityScore: NEUTRAL_QUALITY_SCORE,
      rejectionReason: null,
    }));
  },
};
