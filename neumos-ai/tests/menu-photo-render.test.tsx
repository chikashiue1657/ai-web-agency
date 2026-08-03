import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import type { StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
  storeName: "Photo Cafe", industry: "カフェ", area: "東京",
  targetCustomer: "コーヒー好き", mainProblem: "認知不足", salesAngle: "自家焙煎",
  websiteGoal: "来店予約", siteConcept: "落ち着いた喫茶店", recommendedPages: ["トップ"],
  seoKeywords: ["東京 カフェ"], tone: "上質", offer: "季節のラテ",
  realData: {
    menuItems: [{ name: "季節のラテ", price: "650円", imageUrl: "https://example.com/latte.jpg" }],
  },
};

describe("v2 menu photos", () => {
  it("renders a factual menu photo with an item-specific alt", () => {
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={brief} contents={generateWebsiteRuleBased(brief)} />
    );
    expect(html).toContain('src="https://example.com/latte.jpg"');
    expect(html).toContain('alt="季節のラテのメニュー写真"');
  });

  it("keeps text-only menu rendering when no photo is present", () => {
    const noPhoto = { ...brief, realData: { menuItems: [{ name: "季節のラテ", price: "650円" }] } };
    const html = renderToStaticMarkup(
      <WebsiteRendererV2 brief={noPhoto} contents={generateWebsiteRuleBased(noPhoto)} />
    );
    expect(html).toContain("季節のラテ");
    expect(html).not.toContain("メニュー写真");
  });
});
