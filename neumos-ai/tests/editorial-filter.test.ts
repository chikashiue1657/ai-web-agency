import { describe, expect, it } from "vitest";
import { buildUtilityFacts, filterArtifacts } from "@/lib/editorial/filter";
import { isImageArtifact, isTextArtifact } from "@/lib/editorial/artifact";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

function makeBrief(overrides: Partial<StoreBrief> = {}): StoreBrief {
  return {
    storeName: "BB-Coffee",
    industry: "カフェ",
    area: "沖縄市",
    targetCustomer: "地域客",
    mainProblem: "新規客が少ない",
    salesAngle: "焙煎香る店内",
    websiteGoal: "来店増加",
    siteConcept: "居心地の良いサイト",
    recommendedPages: [],
    seoKeywords: [],
    tone: "親しみやすい",
    offer: "本日の一杯",
    ...overrides,
  };
}

function makeContents(overrides: Partial<GeneratedWebsiteContents> = {}): GeneratedWebsiteContents {
  return {
    concept: "焙煎したての香りが漂う店内。",
    heroTitle: "香りに包まれる、いつもの一杯へ",
    heroSubtitle: "焙煎したての豆で淹れる、毎日通いたくなるカフェ。",
    sections: [],
    gallery: [],
    access: { areaLabel: "沖縄市", addressHint: "沖縄市内", mapQuery: "BB-Coffee 沖縄市" },
    contactMethods: [],
    cta: { headline: "見出し", body: "本文", buttonLabel: "予約する", href: "#contact" },
    seoTitle: "title",
    metaDescription: "description",
    faq: [],
    instagramCaption: "caption",
    googleBusinessImprovement: [],
    strategy: { strengths: [], challenges: [], targetPersona: "persona", differentiators: [] },
    ...overrides,
  };
}

function photoUrls(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `https://example.test/photo-${i}.jpg`);
}

describe("filterArtifacts", () => {
  it("空Artifact(brief/contentsが最小)でも例外を投げず、editorialは空にならない場合がある", () => {
    const result = filterArtifacts(makeBrief(), makeContents());
    // concept由来のtext artifactは残る
    expect(result.editorial.length).toBeGreaterThan(0);
    expect(result.editorial.filter(isTextArtifact).every((a) => a.charCount > 0)).toBe(true);
  });

  it("完全に空(concept含め全て空文字)ならeditorialは空配列になる", () => {
    const result = filterArtifacts(makeBrief(), makeContents({ concept: "" }));
    expect(result.editorial).toEqual([]);
  });

  it("不正なURL文字列でも例外を投げない", () => {
    const brief = makeBrief({ realData: { photoUrls: ["not-a-valid-url", "https://example.test/a.jpg"] } });
    expect(() => filterArtifacts(brief, makeContents())).not.toThrow();
  });

  it("Utility側のフィールドはEditorial(editorial配列)に一切現れない", () => {
    const brief = makeBrief({
      realData: {
        address: "沖縄県沖縄市1-2-3",
        phone: "098-000-0000",
        openingHours: ["月: 10:00-19:00"],
        googleRating: 4.5,
        googleReviewCount: 20,
        menuItems: [{ name: "ブレンド", price: "500円" }],
      },
    });
    const result = filterArtifacts(brief, makeContents());
    const allText = result.editorial.filter(isTextArtifact).map((a) => a.text);
    expect(allText.join(" ")).not.toContain("098-000-0000");
    expect(allText.join(" ")).not.toContain("沖縄県沖縄市1-2-3");
    expect(result.utility.address).toBe("沖縄県沖縄市1-2-3");
    expect(result.utility.phone).toBe("098-000-0000");
    expect(result.utility.googleRating).toBe(4.5);
    expect(result.utility.googleReviewCount).toBe(20);
    expect(result.utility.menuItems).toEqual([{ name: "ブレンド", price: "500円" }]);
  });

  it("40文字以上のmenuItem descriptionはEditorial候補になり、UtilityのmenuItemsとは独立して両方に存在しうる", () => {
    const longDescription =
      "フルーティーな酸味とすっきりとした後味が特徴で、朝の一杯としてゆっくり味わっていただきたい一杯です。";
    const brief = makeBrief({
      realData: { menuItems: [{ name: "浅煎り", price: "550円", description: longDescription }] },
    });
    const result = filterArtifacts(brief, makeContents());
    const texts = result.editorial.filter(isTextArtifact).map((a) => a.text);
    expect(texts).toContain(longDescription);
    expect(result.utility.menuItems?.[0].description).toBe(longDescription);
  });

  it("写真0枚: 画像artifactは無い", () => {
    const result = filterArtifacts(makeBrief(), makeContents());
    expect(result.editorial.filter(isImageArtifact)).toHaveLength(0);
  });

  it("写真1枚: そのまま1件残る", () => {
    const brief = makeBrief({ realData: { photoUrls: photoUrls(1) } });
    const result = filterArtifacts(brief, makeContents());
    expect(result.editorial.filter(isImageArtifact)).toHaveLength(1);
  });

  it("写真12枚: 上限ちょうどなので12件とも残る", () => {
    const brief = makeBrief({ realData: { photoUrls: photoUrls(12) } });
    const result = filterArtifacts(brief, makeContents());
    expect(result.editorial.filter(isImageArtifact)).toHaveLength(12);
  });

  it("写真13枚以上: 既存の12枚均等サンプリング上限が適用される", () => {
    const brief = makeBrief({ realData: { photoUrls: photoUrls(30) } });
    const result = filterArtifacts(brief, makeContents());
    expect(result.editorial.filter(isImageArtifact)).toHaveLength(12);
  });

  it("クエリ文字列だけが異なる実質同一URLは1件に集約される", () => {
    const brief = makeBrief({
      realData: { photoUrls: ["https://example.test/a.jpg?v=1", "https://example.test/a.jpg?v=2"] },
    });
    const result = filterArtifacts(brief, makeContents());
    expect(result.editorial.filter(isImageArtifact)).toHaveLength(1);
  });

  it("元のbrief/contentsを変更しない", () => {
    const brief = makeBrief({ realData: { photoUrls: photoUrls(20) } });
    const contents = makeContents();
    const briefSnapshot = JSON.parse(JSON.stringify(brief));
    const contentsSnapshot = JSON.parse(JSON.stringify(contents));
    filterArtifacts(brief, contents);
    expect(brief).toEqual(briefSnapshot);
    expect(contents).toEqual(contentsSnapshot);
  });

  it("同じ入力なら同じ出力になる(決定性)", () => {
    const brief = makeBrief({ realData: { photoUrls: photoUrls(20) } });
    const contents = makeContents();
    expect(filterArtifacts(brief, contents)).toEqual(filterArtifacts(brief, contents));
  });
});

describe("buildUtilityFacts", () => {
  it("realData/contentsのフィールドをそのままマッピングする(判断ロジックを持たない)", () => {
    const brief = makeBrief({
      realData: { instagramUrl: "https://instagram.com/bb-coffee", googleMapsUrl: "https://maps.google.com/x" },
    });
    const contents = makeContents({ cta: { headline: "h", body: "b", buttonLabel: "btn", href: "tel:0980000000" } });
    const facts = buildUtilityFacts(brief, contents);
    expect(facts.instagramUrl).toBe("https://instagram.com/bb-coffee");
    expect(facts.googleMapsUrl).toBe("https://maps.google.com/x");
    expect(facts.ctaHref).toBe("tel:0980000000");
    expect(facts.mapQuery).toBe("BB-Coffee 沖縄市");
  });
});
