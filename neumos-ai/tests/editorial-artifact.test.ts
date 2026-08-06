import { describe, expect, it } from "vitest";
import { toArtifacts } from "@/lib/editorial/artifact";
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

describe("toArtifacts", () => {
  it("realData/contentsが最小のとき、conceptだけがtext artifactとして残る", () => {
    const artifacts = toArtifacts(makeBrief(), makeContents());
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({ media: "text", text: "焙煎したての香りが漂う店内。", absorbedCount: 0 });
  });

  it("photoUrlsを画像artifactとして抽出し、absorbedCountは常に0で始まる", () => {
    const brief = makeBrief({ realData: { photoUrls: ["https://example.test/a.jpg", "https://example.test/b.jpg"] } });
    const artifacts = toArtifacts(brief, makeContents());
    const images = artifacts.filter((a) => a.media === "image");
    expect(images).toHaveLength(2);
    expect(images.every((a) => a.absorbedCount === 0)).toBe(true);
    expect(images.map((a) => (a as { url: string }).url)).toEqual([
      "https://example.test/a.jpg",
      "https://example.test/b.jpg",
    ]);
  });

  it("supplementalImagesはrequiresDisclosureにdisclosure文言を保持する", () => {
    const brief = makeBrief({
      realData: {
        supplementalImages: [
          {
            url: "https://example.test/atmo.png",
            source: "openai-generated",
            role: "atmosphere",
            altText: "雰囲気",
            disclosure: "AI生成イメージ（実際の店舗写真ではありません）",
            promptVersion: "cafe-atmosphere-v1",
          },
        ],
      },
    });
    const artifacts = toArtifacts(brief, makeContents());
    const image = artifacts.find((a) => a.media === "image");
    expect(image).toMatchObject({ requiresDisclosure: "AI生成イメージ（実際の店舗写真ではありません）" });
  });

  it("kind=about/featureのsectionsをsplitBulletLinesで分割してtext artifact化する", () => {
    const brief = makeBrief();
    const contents = makeContents({
      sections: [
        { id: "f1", kind: "feature", heading: "選ばれる理由", body: "・自家焙煎\n・落ち着いた空間" },
        { id: "s1", kind: "service", heading: "メニュー", body: "コーヒー各種" },
      ],
    });
    const artifacts = toArtifacts(brief, contents);
    const texts = artifacts.filter((a) => a.media === "text").map((a) => (a as { text: string }).text);
    expect(texts).toContain("自家焙煎");
    expect(texts).toContain("落ち着いた空間");
    expect(texts).not.toContain("コーヒー各種"); // kind=serviceはEditorial候補にしない
  });

  it("menuItemsのdescriptionは40文字以上のみtext artifact化する", () => {
    const brief = makeBrief({
      realData: {
        menuItems: [
          { name: "深煎りブレンド", price: "500円", description: "短い説明" },
          {
            name: "浅煎りブレンド",
            price: "550円",
            description:
              "フルーティーな酸味とすっきりとした後味が特徴で、朝の一杯としてゆっくり味わっていただきたい一杯です。",
          },
        ],
      },
    });
    const artifacts = toArtifacts(brief, makeContents());
    const texts = artifacts.filter((a) => a.media === "text").map((a) => (a as { text: string }).text);
    expect(texts.some((t) => t.includes("短い説明"))).toBe(false);
    expect(texts.some((t) => t.includes("フルーティーな酸味"))).toBe(true);
  });

  it("reviewsのtextをそのままtext artifact化する", () => {
    const brief = makeBrief({ realData: { reviews: [{ text: "とても居心地が良かったです。", authorName: "A" }] } });
    const artifacts = toArtifacts(brief, makeContents());
    const texts = artifacts.filter((a) => a.media === "text").map((a) => (a as { text: string }).text);
    expect(texts).toContain("とても居心地が良かったです。");
  });

  it("空文字・空白のみのテキストは除外する", () => {
    const brief = makeBrief();
    const contents = makeContents({ concept: "   " });
    const artifacts = toArtifacts(brief, contents);
    expect(artifacts).toHaveLength(0);
  });

  it("sourceOrderは抽出順に単調増加する", () => {
    const brief = makeBrief({
      realData: { photoUrls: ["https://example.test/a.jpg", "https://example.test/b.jpg"] },
    });
    const artifacts = toArtifacts(brief, makeContents());
    const orders = artifacts.map((a) => a.sourceOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("同じ入力なら同じ出力になる(決定性)", () => {
    const brief = makeBrief({ realData: { photoUrls: ["https://example.test/a.jpg"] } });
    const contents = makeContents();
    expect(toArtifacts(brief, contents)).toEqual(toArtifacts(brief, contents));
  });

  it("元のbrief/contentsを変更しない", () => {
    const brief = makeBrief({ realData: { photoUrls: ["https://example.test/a.jpg"] } });
    const contents = makeContents();
    const briefSnapshot = JSON.parse(JSON.stringify(brief));
    const contentsSnapshot = JSON.parse(JSON.stringify(contents));
    toArtifacts(brief, contents);
    expect(brief).toEqual(briefSnapshot);
    expect(contents).toEqual(contentsSnapshot);
  });
});
