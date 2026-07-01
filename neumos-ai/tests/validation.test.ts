import { describe, expect, it } from "vitest";
import { GenerateRequestSchema } from "@/lib/validation";

const validBrief = {
  storeName: "Cafe Okinawa",
  industry: "カフェ",
  area: "那覇市",
  targetCustomer: "観光客・地元の若い世代",
  mainProblem: "リピーターが増えない",
  salesAngle: "沖縄食材を使った健康志向メニュー",
  websiteGoal: "来店予約の増加",
  siteConcept: "沖縄の自然を感じるカフェ",
  recommendedPages: ["トップ", "メニュー", "アクセス"],
  seoKeywords: ["那覇市 カフェ", "沖縄 健康 カフェ"],
  tone: "落ち着いた・ナチュラル",
  offer: "初回ドリンク1杯無料",
};

describe("GenerateRequestSchema", () => {
  it("accepts a valid website generation request", () => {
    const result = GenerateRequestSchema.safeParse({ generationType: "website", brief: validBrief });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown generationType", () => {
    const result = GenerateRequestSchema.safeParse({ generationType: "tiktok_ad", brief: validBrief });
    expect(result.success).toBe(false);
  });

  it("rejects a brief missing required fields", () => {
    const { storeName, ...rest } = validBrief;
    const result = GenerateRequestSchema.safeParse({ generationType: "website", brief: rest });
    expect(result.success).toBe(false);
  });

  it("defaults recommendedPages/seoKeywords to empty arrays when omitted", () => {
    const { recommendedPages, seoKeywords, ...rest } = validBrief;
    const result = GenerateRequestSchema.safeParse({ generationType: "website", brief: rest });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief.recommendedPages).toEqual([]);
      expect(result.data.brief.seoKeywords).toEqual([]);
    }
  });

  it("ignores an extra generationType field inside brief (MVP NeumosBrief compatibility)", () => {
    const result = GenerateRequestSchema.safeParse({
      generationType: "website",
      brief: { ...validBrief, generationType: "website" },
    });
    expect(result.success).toBe(true);
  });
});
