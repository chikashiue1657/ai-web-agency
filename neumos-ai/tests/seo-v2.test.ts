import { describe, expect, it } from "vitest";
import { buildCafeStructuredData, serializeStructuredData } from "@/lib/seo-v2";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地域のお客様",
  mainProblem: "新規顧客への認知",
  salesAngle: "自家焙煎コーヒー",
  websiteGoal: "来店予約",
  siteConcept: "落ち着いて過ごせる店",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた",
  offer: "本日の一杯",
  realData: {
    address: "沖縄県沖縄市中央1-2-3",
    phone: "098-123-4567",
    googleRating: 4.7,
    googleReviewCount: 128,
    photoUrls: ["https://example.com/coffee.jpg"],
    websiteUrl: "https://bb-coffee.example/",
    instagramUrl: "https://instagram.com/bb_coffee",
  },
};

const contents = {
  seoTitle: "BB-Coffee | 沖縄市の自家焙煎カフェ",
  metaDescription: "沖縄市の自家焙煎カフェBB-Coffee。",
} as GeneratedWebsiteContents;

describe("v2 SEO", () => {
  it("実店舗データだけでCafeOrCoffeeShop構造化データを作る", () => {
    const data = buildCafeStructuredData(brief, contents, "https://neumos-ai.vercel.app/preview/id/v2") as Record<string, unknown>;
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "CafeOrCoffeeShop",
      name: "BB-Coffee",
      telephone: "098-123-4567",
      aggregateRating: { ratingValue: 4.7, reviewCount: 128, bestRating: 5 },
      sameAs: ["https://bb-coffee.example/", "https://instagram.com/bb_coffee"],
    });
  });

  it("存在しない評価やリンクは補完しない", () => {
    const data = buildCafeStructuredData({ ...brief, realData: { address: brief.realData?.address } }, contents, "https://example.com") as Record<string, unknown>;
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("sameAs");
    expect(data).not.toHaveProperty("telephone");
  });

  it("JSON-LDへHTML終了タグを注入できない", () => {
    expect(serializeStructuredData({ value: "</script><script>alert(1)</script>" })).not.toContain("</script>");
    expect(serializeStructuredData({ value: "</script>" })).toContain("\\u003c/script>");
  });
});
