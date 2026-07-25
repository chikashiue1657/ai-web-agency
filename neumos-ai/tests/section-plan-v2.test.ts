import { describe, expect, it } from "vitest";
import { buildCafeV2Plan } from "@/lib/engine/section-plan-v2";
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

describe("buildCafeV2Plan", () => {
  it("最小構成（feature/service無し・realDataも無し）では hero/story/accessHours/cta のみ", () => {
    const plan = buildCafeV2Plan(makeBrief(), makeContents());
    expect(plan.blocks).toEqual(["hero", "story", "accessHours", "cta"]);
    expect(plan.photoPlan.tier).toBe("none");
  });

  it("featureセクションがあれば signature を表示する", () => {
    const plan = buildCafeV2Plan(
      makeBrief(),
      makeContents({ sections: [{ id: "f1", kind: "feature", heading: "選ばれる理由", body: "焙煎香る店内" }] })
    );
    expect(plan.blocks).toContain("signature");
  });

  it("serviceセクションがあれば menu を表示する", () => {
    const plan = buildCafeV2Plan(
      makeBrief(),
      makeContents({ sections: [{ id: "s1", kind: "service", heading: "本日のコーヒー", body: "深煎りブレンド" }] })
    );
    expect(plan.blocks).toContain("menu");
  });

  it("googleRatingがあれば trust を表示する", () => {
    const plan = buildCafeV2Plan(makeBrief({ realData: { googleRating: 4.6 } }), makeContents());
    expect(plan.blocks).toContain("trust");
  });

  it("googleRatingもreviewCountも無ければ trust を表示しない", () => {
    const plan = buildCafeV2Plan(makeBrief(), makeContents());
    expect(plan.blocks).not.toContain("trust");
  });

  it("写真が1枚のみだとHero専用になり、Gallery用に回せる分が無いのでphotoStoryは表示しない", () => {
    const plan = buildCafeV2Plan(makeBrief({ realData: { photoUrls: ["https://example.com/a.jpg"] } }), makeContents());
    expect(plan.blocks).not.toContain("photoStory");
    expect(plan.photoPlan.heroPhotoUrl).toBe("https://example.com/a.jpg");
  });

  it("写真が2枚だとHero+Story用で使い切り、Gallery用が無いのでphotoStoryは表示しない", () => {
    const plan = buildCafeV2Plan(
      makeBrief({ realData: { photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"] } }),
      makeContents()
    );
    expect(plan.blocks).not.toContain("photoStory");
    expect(plan.photoPlan.storyPhotoUrl).toBe("https://example.com/b.jpg");
  });

  it("写真が3枚以上あればHero+Storyの後にGallery用が残り、photoStoryを表示する", () => {
    const plan = buildCafeV2Plan(
      makeBrief({
        realData: {
          photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"],
        },
      }),
      makeContents()
    );
    expect(plan.blocks).toContain("photoStory");
    expect(plan.photoPlan.galleryPhotoUrls).toEqual(["https://example.com/c.jpg"]);
  });

  it("hero/story/accessHours/ctaは常に含まれる", () => {
    const plan = buildCafeV2Plan(makeBrief(), makeContents());
    expect(plan.blocks[0]).toBe("hero");
    expect(plan.blocks).toContain("story");
    expect(plan.blocks).toContain("accessHours");
    expect(plan.blocks.at(-1)).toBe("cta");
  });
});
