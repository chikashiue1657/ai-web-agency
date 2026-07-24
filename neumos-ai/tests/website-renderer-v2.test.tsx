import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import type { StoreBrief } from "@/lib/types";

const cafeBrief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地元客・観光客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "自家焙煎の香りと落ち着いた店内体験",
  websiteGoal: "来店予約とInstagramフォローの増加",
  siteConcept: "焙煎の香りが伝わる、静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯 500円〜",
};

describe("WebsiteRendererV2", () => {
  it("カフェ業種ではv2デザインを描画し、Heroに単一CTA・可変セクションを含む", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);

    expect(html).toContain('id="top"');
    expect(html).toContain('id="story"');
    expect(html).toContain('id="access"');
    expect(html).toContain('id="contact"');
    expect(html).toContain(cafeBrief.storeName);
    // Heroのリンク（唯一のCTA）はcontents.cta.hrefと一致する
    expect(html).toContain(`href="${contents.cta.href}"`);
    // v1固有のカード多用セクションは出ない
    expect(html).not.toContain('id="gallery"');
    expect(html).not.toContain('id="feature"');
  });

  it("カフェ以外の業種ではv1へフォールバックし、注記バナーを表示する", () => {
    const salonBrief: StoreBrief = { ...cafeBrief, storeName: "美容室 結", industry: "美容室" };
    const contents = generateWebsiteRuleBased(salonBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={salonBrief} contents={contents} />);

    expect(html).toContain("v2デザインエンジンは現在カフェ業態のみ対応しています");
    expect(html).toContain('id="gallery"'); // v1のセクション構成に戻る
  });

  it("realDataにreviewsが無ければレビュー本文は表示しない（型はあるが未提供時は非表示）", () => {
    const brief: StoreBrief = {
      ...cafeBrief,
      realData: { googleRating: 4.6, googleReviewCount: 128 },
    };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain("★4.6");
    expect(html).toContain("128件のレビューより");
  });

  it("realDataにreviewsがあれば本文を表示する", () => {
    const brief: StoreBrief = {
      ...cafeBrief,
      realData: {
        googleRating: 4.6,
        googleReviewCount: 128,
        reviews: [
          { text: "焙煎の香りが素晴らしく、店内も落ち着いていました。", authorName: "A.T." },
          { text: "スタッフの対応が丁寧で、また利用したいです。" },
        ],
      },
    };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain("焙煎の香りが素晴らしく、店内も落ち着いていました。");
    expect(html).toContain("A.T.");
    expect(html).toContain("スタッフの対応が丁寧で、また利用したいです。");
  });

  it("写真0枚では写真セクション自体を出さない", () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} />);
    expect(html).not.toContain('id="photo-story"');
  });

  it("写真1枚ではHeroの背景に使われ、写真セクションは出さない（重複表示しない）", () => {
    const brief: StoreBrief = { ...cafeBrief, realData: { photoUrls: ["https://example.com/a.jpg"] } };
    const contents = generateWebsiteRuleBased(brief);
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={brief} contents={contents} />);
    expect(html).toContain('src="https://example.com/a.jpg"');
    expect(html).not.toContain('id="photo-story"');
  });
});
