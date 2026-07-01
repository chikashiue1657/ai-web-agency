import { describe, expect, it } from "vitest";
import { generateWebsiteRuleBased, analyzeStrategy, buildPageStructure } from "@/lib/engine/rule-based";
import type { StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
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

describe("rule-based marketing engine", () => {
  it("analyzes strategy before generating any copy", () => {
    const strategy = analyzeStrategy(brief);
    expect(strategy.strengths.length).toBeGreaterThan(0);
    expect(strategy.challenges).toContain(brief.mainProblem);
    expect(strategy.targetPersona).toContain(brief.area);
  });

  it("falls back to default page structure when recommendedPages is too sparse", () => {
    const pages = buildPageStructure({ ...brief, recommendedPages: [] });
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps recommendedPages as-is when sufficient", () => {
    const pages = buildPageStructure(brief);
    expect(pages).toEqual(brief.recommendedPages);
  });

  it("produces a fully-populated GeneratedWebsiteContents without any LLM", () => {
    const contents = generateWebsiteRuleBased(brief);
    expect(contents.concept).toBeTruthy();
    expect(contents.heroTitle).toContain(brief.storeName);
    expect(contents.sections.length).toBeGreaterThan(0);
    expect(contents.cta.buttonLabel).toBeTruthy();
    expect(contents.seoTitle.length).toBeLessThanOrEqual(60);
    expect(contents.metaDescription.length).toBeLessThanOrEqual(120);
    expect(contents.faq.length).toBeGreaterThan(0);
    expect(contents.instagramCaption).toContain(brief.storeName);
    expect(contents.googleBusinessImprovement.length).toBeGreaterThan(0);
    expect(contents.strategy.strengths.length).toBeGreaterThan(0);
  });

  it("picks a reservation-oriented CTA label when websiteGoal mentions 予約", () => {
    const contents = generateWebsiteRuleBased(brief);
    expect(contents.cta.buttonLabel).toBe("今すぐ予約する");
  });
});
