import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import type { BrandPlan } from "@/lib/brand-director/types";
import type { StoreBrief } from "@/lib/types";

/**
 * WebsiteRendererV2の`brandPlan`（Brand Director接続層）の反映を検証する。
 * ここではBrandPlan自体をテスト側で直接組み立てて渡す（OpenAI/rule-providerの
 * 実装は brand-director-v2-connector.test.ts で別途検証済み）ため、
 * このファイルは「BrandPlanが与えられた場合にレンダラーが正しく反映するか」
 * だけに専念する。
 */
const cafeBrief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地元客・観光客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "自家焙煎の香りと落ち着いた店内体験",
  websiteGoal: "来店予約とInstagramフォローの増加",
  siteConcept: "焙煎の香りが伝わる、静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯 500円〜",
};

function makeBrandPlan(overrides: Partial<BrandPlan> = {}): BrandPlan {
  return {
    brandArchetype: "artisan",
    industry: "cafe",
    audiences: ["地元客・観光客"],
    customerIntent: "新規客の獲得が伸び悩んでいる",
    moodKeywords: ["落ち着いた・上質", "自家焙煎の香りと落ち着いた店内体験", "本日の一杯"],
    valueProposition: "自家焙煎の香りと落ち着いた店内体験",
    visualDirection: { paletteHint: "neutral", typographyTone: "editorial-serif", photoTreatment: "framed" },
    copyDirection: { tone: "落ち着いた・上質", emphasis: "atmosphere" },
    layoutVariant: "direct",
    photoAssignments: [],
    ctaStrategy: { placement: "end-only", urgency: "medium" },
    confidence: 0.7,
    evidence: [{ field: "moodKeywords", basis: "brief", detail: "brief.toneより" }],
    ...overrides,
  };
}

describe("WebsiteRendererV2: brandPlan省略時（既存動作の回帰確認）", () => {
  it("brandPlanを渡さない場合、既定テーマ（amber/serif）のまま描画される", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).toContain("text-amber-900");
    expect(html).toContain("font-serif");
  });
});

describe("WebsiteRendererV2: visualDirectionの反映", () => {
  it("paletteHint=high-contrastの場合、accentTextがtext-blackになる", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ visualDirection: { paletteHint: "high-contrast", typographyTone: "editorial-serif", photoTreatment: "framed" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("text-black");
    expect(html).not.toContain("text-amber-900");
  });

  it("typographyTone=clean-sansの場合、displayFontがfont-sansになる", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ visualDirection: { paletteHint: "neutral", typographyTone: "clean-sans", photoTreatment: "framed" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("font-sans");
    expect(html).not.toContain("font-serif");
  });
});

describe("WebsiteRendererV2: layoutVariantの反映", () => {
  const photoBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    },
  };

  it("layoutVariant=immersiveかつ写真が3枚以上ある場合、photoStoryがstoryより前に来る", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "immersive" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html.indexOf('id="photo-story"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="photo-story"')).toBeLessThan(html.indexOf('id="story"'));
  });

  it("layoutVariant=directでは並びが変わらない（storyが先、photoStoryは後）", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({ layoutVariant: "direct" });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html.indexOf('id="story"')).toBeLessThan(html.indexOf('id="photo-story"'));
  });
});

describe("WebsiteRendererV2: ctaStrategyの反映", () => {
  it("placement=after-storyの場合、末尾に加えてstory直後にも控えめなCTAが挿入される（2箇所）", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ ctaStrategy: { placement: "after-story", urgency: "high" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    const occurrences = html.split(contents.cta.buttonLabel).length - 1;
    // Heroの単一CTA + 末尾CTA + 早期CTA = 3箇所（Heroは既存仕様で常に1つ）。
    expect(occurrences).toBeGreaterThanOrEqual(3);
    expect(html).toContain('id="contact"');
  });

  it("placement=end-onlyの場合、早期CTAは追加されない", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = makeBrandPlan({ ctaStrategy: { placement: "end-only", urgency: "low" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    const occurrences = html.split(contents.cta.buttonLabel).length - 1;
    // Heroの単一CTA + 末尾CTA = 2箇所のみ。
    expect(occurrences).toBe(2);
  });
});

describe("WebsiteRendererV2: photoAssignmentsの反映（実データ優先・捏造防止）", () => {
  const photoBrief: StoreBrief = {
    ...cafeBrief,
    realData: {
      photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
    },
  };

  it("BrandPlanのphotoAssignmentsで役割指定された写真がheroに使われる（位置ではなく役割で決まる）", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({
      photoAssignments: [
        { photoUrl: "https://example.com/c.jpg", role: "hero", qualityScore: 90, rejectionReason: null },
        { photoUrl: "https://example.com/a.jpg", role: "story", qualityScore: 80, rejectionReason: null },
      ],
    });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain('src="https://example.com/c.jpg"');
  });

  it("実データに存在しないURLがphotoAssignmentsに混ざっている場合は無視し、位置ベースへフォールバックする", () => {
    const contents = generateWebsiteRuleBased(photoBrief);
    const brandPlan = makeBrandPlan({
      photoAssignments: [
        { photoUrl: "https://example.com/does-not-exist.jpg", role: "hero", qualityScore: 90, rejectionReason: null },
      ],
    });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={photoBrief} contents={contents} brandPlan={brandPlan} />);
    // 捏造されたURLは使われず、位置ベース（1枚目=Hero）にフォールバックする。
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).not.toContain("does-not-exist.jpg");
  });
});

describe("WebsiteRendererV2: v1経路への非影響", () => {
  it("カフェ以外の業種ではbrandPlanを渡してもv1へフォールバックし、BrandPlanは無視される", () => {
    const salonBrief: StoreBrief = { ...cafeBrief, storeName: "美容室 結", industry: "美容室" };
    const contents = generateWebsiteRuleBased(salonBrief);
    const brandPlan = makeBrandPlan({ visualDirection: { paletteHint: "high-contrast", typographyTone: "bold-display", photoTreatment: "framed" } });
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={salonBrief} contents={contents} brandPlan={brandPlan} />);
    expect(html).toContain("v2デザインエンジンは現在カフェ業態のみ対応しています");
    expect(html).toContain('id="gallery"');
  });
});
