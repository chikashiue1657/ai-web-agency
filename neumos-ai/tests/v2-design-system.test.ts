import { describe, expect, it } from "vitest";
import type { BrandArchetype, BrandPlan } from "@/lib/brand-director/types";
import {
  DEFAULT_TOKENS,
  deriveArtDirection,
  deriveHeaderTheme,
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

describe("deriveArtDirection", () => {
  it("7つのbrandArchetypeを過不足なく3方向へ分類する", () => {
    const expected: Record<BrandArchetype, string> = {
      "heritage-traditional": "japanese-editorial",
      "modern-minimal": "japanese-editorial",
      "wellness-calm": "japanese-editorial",
      "luxury-quiet": "sensory-immersive",
      "energetic-casual": "sensory-immersive",
      artisan: "warm-craft",
      "warm-hospitality": "warm-craft",
    };
    for (const [archetype, direction] of Object.entries(expected)) {
      expect(deriveArtDirection(archetype as BrandArchetype)).toBe(direction);
    }
  });
});

describe("resolveV2DesignTokens", () => {
  it("brandPlanが無い場合はDEFAULT_TOKENSを返す(warm-craft方向)", () => {
    expect(resolveV2DesignTokens(undefined, "few")).toEqual(DEFAULT_TOKENS);
    expect(DEFAULT_TOKENS.artDirection).toBe("warm-craft");
  });

  it("heroCompositionはartDirection×layoutVariantで決まり、方向を跨いだ構図は出さない", () => {
    // japanese-editorial: どのlayoutVariantでもsplit-frame固定。
    for (const layoutVariant of ["immersive", "editorial", "direct"] as const) {
      const tokens = resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "modern-minimal", layoutVariant }),
        "few"
      );
      expect(tokens.heroComposition).toBe("split-frame");
    }
    // sensory-immersive: immersive/editorialはfull-bleed-center、directはoverlap-editorial。
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet", layoutVariant: "immersive" }), "few")
        .heroComposition
    ).toBe("full-bleed-center");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet", layoutVariant: "editorial" }), "few")
        .heroComposition
    ).toBe("full-bleed-center");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet", layoutVariant: "direct" }), "few")
        .heroComposition
    ).toBe("overlap-editorial");
    // warm-craft: immersive/directはoverlap-editorial、editorialはsplit-frame。
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "artisan", layoutVariant: "immersive" }), "few")
        .heroComposition
    ).toBe("overlap-editorial");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "artisan", layoutVariant: "editorial" }), "few")
        .heroComposition
    ).toBe("split-frame");
  });

  it("写真0枚(tier=none)の場合、artDirection/layoutVariantに関わらずheroCompositionは常にtypographic", () => {
    for (const brandArchetype of ["modern-minimal", "luxury-quiet", "artisan"] as const) {
      for (const layoutVariant of ["immersive", "editorial", "direct"] as const) {
        expect(
          resolveV2DesignTokens(makeBrandPlan({ brandArchetype, layoutVariant }), "none").heroComposition
        ).toBe("typographic");
      }
    }
  });

  it("typographyScale/surfaceStyle/imageTreatmentはartDirectionごとに固定される", () => {
    const editorial = resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "heritage-traditional" }), "few");
    expect(editorial.typographyScale).toBe("editorial-serif");
    expect(editorial.surfaceStyle).toBe("flat-minimal");
    expect(editorial.imageTreatment).toBe("framed");

    const immersiveQuiet = resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet" }), "few");
    expect(immersiveQuiet.typographyScale).toBe("clean-sans");
    expect(immersiveQuiet.surfaceStyle).toBe("framed-card");
    expect(immersiveQuiet.imageTreatment).toBe("mixed");

    const immersiveEnergetic = resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "energetic-casual" }), "few");
    expect(immersiveEnergetic.typographyScale).toBe("bold-display");
    expect(immersiveEnergetic.surfaceStyle).toBe("framed-card");

    const craft = resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "warm-hospitality" }), "few");
    expect(craft.typographyScale).toBe("editorial-serif");
    expect(craft.surfaceStyle).toBe("paper-warm");
    expect(craft.imageTreatment).toBe("full-bleed");
  });

  it("ctaStyleはurgency由来の値をartDirectionの許容範囲へクランプする", () => {
    // japanese-editorial/warm-craftはsolid-boldを許さない → outline-minimalへ丸める。
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "modern-minimal", ctaStrategy: { placement: "hero", urgency: "high" } }), "few")
        .ctaStyle
    ).toBe("outline-minimal");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "artisan", ctaStrategy: { placement: "hero", urgency: "high" } }), "few")
        .ctaStyle
    ).toBe("outline-minimal");
    // sensory-immersiveはtext-linkを許さない → outline-minimalへ丸める。
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "luxury-quiet", ctaStrategy: { placement: "hero", urgency: "low" } }), "few")
        .ctaStyle
    ).toBe("outline-minimal");
    // 範囲内の値はそのまま通す。
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "energetic-casual", ctaStrategy: { placement: "hero", urgency: "high" } }), "few")
        .ctaStyle
    ).toBe("solid-bold");
    expect(
      resolveV2DesignTokens(makeBrandPlan({ brandArchetype: "artisan", ctaStrategy: { placement: "hero", urgency: "low" } }), "few")
        .ctaStyle
    ).toBe("text-link");
  });

  it("colorBalanceはartDirectionごとの許容範囲へ決定論的にクランプされる", () => {
    // warm-craftはwarm/neutralのみ許可。cool/high-contrastはwarmへ変換される。
    expect(
      resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "artisan", visualDirection: { paletteHint: "cool", typographyTone: "bold-display", photoTreatment: "mixed" } }),
        "many"
      ).colorBalance
    ).toBe("warm");
    expect(
      resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "warm-hospitality", visualDirection: { paletteHint: "high-contrast", typographyTone: "bold-display", photoTreatment: "mixed" } }),
        "many"
      ).colorBalance
    ).toBe("warm");
    // japanese-editorialはneutral/warmのみ許可。coolはneutralへ変換される。
    expect(
      resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "modern-minimal", visualDirection: { paletteHint: "cool", typographyTone: "bold-display", photoTreatment: "mixed" } }),
        "many"
      ).colorBalance
    ).toBe("neutral");
    // sensory-immersiveは4種すべて許可（クランプしない）。
    expect(
      resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "luxury-quiet", visualDirection: { paletteHint: "cool", typographyTone: "bold-display", photoTreatment: "mixed" } }),
        "many"
      ).colorBalance
    ).toBe("cool");
    expect(
      resolveV2DesignTokens(
        makeBrandPlan({ brandArchetype: "energetic-casual", visualDirection: { paletteHint: "high-contrast", typographyTone: "bold-display", photoTreatment: "mixed" } }),
        "many"
      ).colorBalance
    ).toBe("high-contrast");
  });

  it("同じ入力なら常に同じ結果を返す（決定論的・再描画で安定する前提）", () => {
    const plan = makeBrandPlan({ brandArchetype: "wellness-calm", layoutVariant: "editorial" });
    const first = resolveV2DesignTokens(plan, "many");
    const second = resolveV2DesignTokens(plan, "many");
    expect(first).toEqual(second);
  });
});

describe("deriveHeaderTheme", () => {
  it("写真ありの構図はcomposition基準で決まる(artDirectionに関わらず)", () => {
    expect(deriveHeaderTheme("warm-craft", "full-bleed-center")).toBe("light");
    expect(deriveHeaderTheme("sensory-immersive", "full-bleed-center")).toBe("light");
    expect(deriveHeaderTheme("warm-craft", "overlap-editorial")).toBe("dark");
    expect(deriveHeaderTheme("sensory-immersive", "overlap-editorial")).toBe("dark");
    expect(deriveHeaderTheme("warm-craft", "split-frame")).toBe("dark");
    expect(deriveHeaderTheme("japanese-editorial", "split-frame")).toBe("dark");
  });

  it("写真0枚(typographic)はartDirectionの背景色に合わせる(sensory-immersiveだけ暗色背景→light)", () => {
    expect(deriveHeaderTheme("sensory-immersive", "typographic")).toBe("light");
    expect(deriveHeaderTheme("warm-craft", "typographic")).toBe("dark");
    expect(deriveHeaderTheme("japanese-editorial", "typographic")).toBe("dark");
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
