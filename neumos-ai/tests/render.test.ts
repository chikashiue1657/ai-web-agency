import { describe, expect, it } from "vitest";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { renderWebsitePreviewHtml } from "@/lib/preview/render";
import { toLegacyGeneratedContents } from "@/lib/bridge";
import type { StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
  storeName: "焼肉 山",
  industry: "焼肉店",
  area: "沖縄市",
  targetCustomer: "ファミリー層",
  mainProblem: "平日夜の集客が弱い",
  salesAngle: "石垣牛を使ったコース料理",
  websiteGoal: "来店予約の増加",
  siteConcept: "特別な日に選ばれる焼肉店",
  recommendedPages: ["トップ", "コース紹介", "アクセス", "お問い合わせ"],
  seoKeywords: ["沖縄市 焼肉", "石垣牛"],
  tone: "高級感・落ち着いた",
  offer: "記念日コース10%オフ",
};

describe("renderWebsitePreviewHtml", () => {
  it("produces a self-contained HTML document with escaped content", () => {
    const contents = generateWebsiteRuleBased(brief);
    const html = renderWebsitePreviewHtml(brief, contents);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain(contents.heroTitle);
    expect(html).toContain(contents.cta.buttonLabel);
    for (const faq of contents.faq) {
      expect(html).toContain(faq.question);
    }
  });

  it("escapes HTML-significant characters to avoid breaking the document", () => {
    const dangerousBrief: StoreBrief = { ...brief, offer: '<script>alert("x")</script>' };
    const contents = generateWebsiteRuleBased(dangerousBrief);
    const html = renderWebsitePreviewHtml(dangerousBrief, contents);
    expect(html).not.toContain("<script>alert");
  });
});

describe("toLegacyGeneratedContents", () => {
  it("maps the structured contents into MVP-compatible GeneratedContent[] items", () => {
    const contents = generateWebsiteRuleBased(brief);
    const items = toLegacyGeneratedContents(contents, "https://example.com/preview/abc");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => typeof i.type === "string")).toBe(true);
    const faqItem = items.find((i) => i.type === "faq");
    expect(faqItem?.meta?.items).toEqual(contents.faq);
  });
});
