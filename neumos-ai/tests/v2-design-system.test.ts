import { describe, expect, it } from "vitest";
import type { BrandPlan } from "@/lib/brand-director/types";
import {
  DEFAULT_TOKENS,
  resolveSurfaceClasses,
  resolveTypographyClasses,
  resolveV2DesignTokens,
} from "@/lib/engine/v2-design-system";

function makeBrandPlan(overrides: Partial<BrandPlan> = {}): BrandPlan {
  return {
    brandArchetype: "artisan",
    industry: "cafe",
    audiences: ["地元客"],
    customerIntent: "テスト",
    moodKeywords: ["落ち着いた", "静か", "香り"],
    valueProposition: "テスト",
    visualDirection: { paletteHint: "neutral", typographyTone: "editorial-serif", photoTreatment: "full-bleed" },
    copyDirection: { tone: "落ち着いた", emphasis: "atmosphere" },
    layoutVariant: "direct",
    photoAssignments: [],
    ctaStrategy: { placement: "hero", urgency: "low" },
    confidence: 0.7,
    evidence: [{ field: "moodKeywords", basis: "brief", detail: "test" }],
    ...overrides,
  };
}

describe("resolveV2DesignTokens", () => {
  it("brandPlanが無い場合はDEFAULT_TOKENSを返す", () => {
    expect(resolveV2DesignTokens(undefined, "few")).toEqual(DEFAULT_TOKENS);
  });

  it("layoutVariantごとにheroCompositionが変わる（写真ありの場合）", () => {
    expect(resolveV2DesignTokens(makeBrandPlan({ layoutVariant: "immersive" }), "few").heroComposition).toBe(
      "full-bleed-center"
    );
    expect(resolveV2DesignTokens(makeBrandPlan({ layoutVariant: "editorial" }), "few").heroComposition).toBe(
      "split-frame"
    );
    expect(resolveV2DesignTokens(makeBrandPlan({ layoutVariant: "direct" }), "few").heroComposition).toBe(
      "overlap-editorial"
    );
  });

  it("写真0枚(tier=none)の場合、layoutVariantに関わらずheroCompositionは常にtypographic", () => {
    for (const layoutVariant of ["immersive", "editorial", "direct"] as const) {
      expect(resolveV2DesignTokens(makeBrandPlan({ layoutVariant }), "none").heroComposition).toBe("typographic");
    }
  });

  it("brandArchetypeごとにsectionRhythmとsurfaceStyleが変わる", () => {
    expect(resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet" }), "few").sectionRhythm).toBe("airy");
    expect(resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "energetic-casual" }), "few").sectionRhythm).toBe(
      "dense"
    );
    expect(resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "artisan" }), "few").surfaceStyle).toBe("paper-warm");
    expect(resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "modern-minimal" }), "few").surfaceStyle).toBe(
      "flat-minimal"
    );
  });

  it("visualDirectionのpaletteHint/photoTreatment/typographyToneをそのまま反映する", () => {
    const tokens = resolveV2DesignTokens(
      makeBrandPlan({ visualDirection: { paletteHint: "cool", typographyTone: "bold-display", photoTreatment: "mixed" } }),
      "many"
    );
    expect(tokens.colorBalance).toBe("cool");
    expect(tokens.typographyScale).toBe("bold-display");
    expect(tokens.imageTreatment).toBe("mixed");
  });

  it("ctaStrategy.urgencyごとにctaStyleが変わる", () => {
    expect(resolveV2DesignTokens(makeBrandPlan({ ctaStrategy: { placement: "hero", urgency: "low" } }), "few").ctaStyle).toBe(
      "text-link"
    );
    expect(
      resolveV2DesignTokens(makeBrandPlan({ ctaStrategy: { placement: "hero", urgency: "medium" } }), "few").ctaStyle
    ).toBe("outline-minimal");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ ctaStrategy: { placement: "hero", urgency: "high" } }), "few").ctaStyle
    ).toBe("solid-bold");
  });

  it("同じ入力なら常に同じ結果を返す（決定論的・再描画で安定する前提）", () => {
    const plan = makeBrandPlan({ brandArchetype: "wellness-calm", layoutVariant: "editorial" });
    const first = resolveV2DesignTokens(plan, "many");
    const second = resolveV2DesignTokens(plan, "many");
    expect(first).toEqual(second);
  });
});

describe("resolveSurfaceClasses", () => {
  it("4種すべてに対し空でないクラス文字列を返す", () => {
    for (const style of ["paper-warm", "flat-minimal", "framed-card", "raw-editorial"] as const) {
      const classes = resolveSurfaceClasses(style);
      expect(classes.cardBg.length).toBeGreaterThan(0);
      expect(classes.divider.length).toBeGreaterThan(0);
    }
  });
});

describe("resolveTypographyClasses", () => {
  it("3種すべてに対しheroTitle/sectionHeadingクラスを返す", () => {
    for (const scale of ["editorial-serif", "clean-sans", "bold-display"] as const) {
      const classes = resolveTypographyClasses(scale);
      expect(classes.heroTitle.length).toBeGreaterThan(0);
      expect(classes.sectionHeading.length).toBeGreaterThan(0);
    }
  });
});
