import { describe, expect, it } from "vitest";
import { GenerateRequestSchema, StoreRealDataSchema } from "@/lib/validation";

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

  it("accepts websiteUrl/googleMapsUrl when present", () => {
    const result = GenerateRequestSchema.safeParse({
      generationType: "website",
      brief: {
        ...validBrief,
        realData: { websiteUrl: "https://example-cafe.jp", googleMapsUrl: "https://maps.google.com/?cid=123" },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("StoreRealDataSchema: websiteUrl/googleMapsUrlの安全なURL検証", () => {
  it("httpsのwebsiteUrl/googleMapsUrlを受理する", () => {
    const result = StoreRealDataSchema.safeParse({
      websiteUrl: "https://example-cafe.jp",
      googleMapsUrl: "https://maps.google.com/?cid=123",
    });
    expect(result.success).toBe(true);
  });

  it("websiteUrlはhttpも許容する（既存データ互換：SSL未導入の実店舗サイトがあり得るため）", () => {
    const result = StoreRealDataSchema.safeParse({ websiteUrl: "http://example-cafe.jp" });
    expect(result.success).toBe(true);
  });

  it("googleMapsUrlはhttpを拒否する（Google Places由来のgoogleMapsUriは常にhttps契約のため）", () => {
    const result = StoreRealDataSchema.safeParse({ googleMapsUrl: "http://maps.google.com/?cid=123" });
    expect(result.success).toBe(false);
  });

  it("javascript:/data:等の危険なスキームはwebsiteUrl/googleMapsUrlどちらも拒否する", () => {
    for (const dangerous of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)"]) {
      expect(StoreRealDataSchema.safeParse({ websiteUrl: dangerous }).success).toBe(false);
      expect(StoreRealDataSchema.safeParse({ googleMapsUrl: dangerous }).success).toBe(false);
    }
  });

  it("不正な形式の文字列（URLとしてパースできない）は拒否する", () => {
    expect(StoreRealDataSchema.safeParse({ websiteUrl: "not a url" }).success).toBe(false);
    expect(StoreRealDataSchema.safeParse({ googleMapsUrl: "not a url" }).success).toBe(false);
  });

  it("websiteUrl/googleMapsUrlは任意項目のため、省略しても検証は通る（後方互換：既存レコードに項目が無くても壊れない）", () => {
    const result = StoreRealDataSchema.safeParse({ address: "沖縄県那覇市1-1-1" });
    expect(result.success).toBe(true);
  });
});
