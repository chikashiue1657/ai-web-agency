import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRenderer } from "@/components/website/WebsiteRenderer";
import type { StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
  storeName: "整体院 結",
  industry: "整体院",
  area: "宜野湾市",
  targetCustomer: "デスクワーク中心の30-50代",
  mainProblem: "肩こり・腰痛の慢性患者からの紹介が少ない",
  salesAngle: "根本改善を重視した施術方針",
  websiteGoal: "初回予約の増加",
  siteConcept: "身体の根本から整える整体院",
  recommendedPages: ["トップ", "施術メニュー", "お客様の声"],
  seoKeywords: ["宜野湾市 整体", "肩こり 根本改善"],
  tone: "誠実・信頼感",
  offer: "初回カウンセリング無料",
};

describe("WebsiteRenderer", () => {
  it("renders all 9 required sections (Hero/About/Service/Feature/Gallery/FAQ/Access/Contact/Footer)", () => {
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRenderer brief={brief} contents={contents} />);

    expect(html).toContain(contents.heroTitle);
    expect(html).toContain('id="about"');
    expect(html).toContain('id="service"');
    expect(html).toContain('id="feature"');
    expect(html).toContain('id="gallery"');
    expect(html).toContain('id="faq"');
    expect(html).toContain('id="access"');
    expect(html).toContain('id="contact"');
    expect(html).toContain(brief.storeName);

    for (const item of contents.gallery) {
      expect(html).toContain(item.caption);
    }
    for (const faq of contents.faq) {
      expect(html).toContain(faq.question);
    }
    expect(html).toContain(contents.access.areaLabel);
    expect(html).toContain(contents.cta.headline);
  });

  it("renders without throwing even when a brief yields sparse recommendedPages", () => {
    const sparseBrief: StoreBrief = { ...brief, recommendedPages: [] };
    const contents = generateWebsiteRuleBased(sparseBrief);
    expect(() => renderToStaticMarkup(<WebsiteRenderer brief={sparseBrief} contents={contents} />)).not.toThrow();
  });
});
