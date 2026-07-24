import { describe, expect, it } from "vitest";
import {
  truncateJa,
  clampGeneratedContents,
  stripAsides,
  sanitizeBrief,
  preventAwkwardBreaks,
  HERO_TITLE_MAX,
  HERO_SUBTITLE_MAX,
  BODY_MAX,
} from "@/lib/engine/copy-limits";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

describe("truncateJa", () => {
  it("短い文はそのまま返す", () => {
    expect(truncateJa("短い見出し", 20)).toBe("短い見出し");
  });

  it("句点があれば句点の位置で切る", () => {
    const text = "最初の文はここまで。ここからは長い補足の文章がずっと続いていく想定のテキストです。";
    const result = truncateJa(text, 15);
    expect(result).toBe("最初の文はここまで。");
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it("良い区切りが無ければ省略記号付きで強制的に切る", () => {
    const text = "あ".repeat(100);
    const result = truncateJa(text, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("preventAwkwardBreaks", () => {
  it("半角ハイフンを改行不可のハイフン（U+2011）に置き換える（見た目は同じだが店名の途中で改行されない）", () => {
    const result = preventAwkwardBreaks("毎日通いたくなるBB-Coffee");
    expect(result).not.toContain("-");
    expect(result).toContain("‑");
    expect(result.replace(/‑/g, "-")).toBe("毎日通いたくなるBB-Coffee");
  });

  it("ハイフンが無い文はそのまま返す", () => {
    expect(preventAwkwardBreaks("あなた史上最高の髪へ")).toBe("あなた史上最高の髪へ");
  });
});

describe("stripAsides", () => {
  it("単一の括弧書きを取り除く", () => {
    expect(stripAsides("観光客（訪日客含む）")).toBe("観光客");
  });

  it("連続する複数の括弧書きを全て取り除く", () => {
    expect(stripAsides("観光客（訪日客含む）（仮説：要ヒアリングで確定）")).toBe("観光客");
  });

  it("括弧が無ければそのまま返す", () => {
    expect(stripAsides("観光客")).toBe("観光客");
  });
});

describe("sanitizeBrief", () => {
  it("自由記述フィールドから括弧書きの社内メモを取り除く", () => {
    const brief: StoreBrief = {
      storeName: "BB-Coffee",
      industry: "カフェ",
      area: "沖縄市",
      targetCustomer: "地域客＋観光客（仮説：要ヒアリングで確定）",
      mainProblem: "新規客が少ない",
      salesAngle: "検索流入の確立",
      websiteGoal: "予約増加",
      siteConcept: "居心地の良いサイト",
      recommendedPages: [],
      seoKeywords: [],
      tone: "親しみやすい",
      offer: "初回無料",
    };
    const sanitized = sanitizeBrief(brief);
    expect(sanitized.targetCustomer).toBe("地域客＋観光客");
    expect(sanitized.storeName).toBe(brief.storeName); // 対象外フィールドは変更しない
  });
});

describe("clampGeneratedContents", () => {
  function makeContents(overrides: Partial<GeneratedWebsiteContents> = {}): GeneratedWebsiteContents {
    return {
      concept: "あ".repeat(300),
      heroTitle: "あ".repeat(300),
      heroSubtitle: "あ".repeat(300),
      sections: [{ id: "s1", kind: "about", heading: "About", body: "あ".repeat(300) }],
      gallery: [],
      access: { areaLabel: "エリア", addressHint: "あ".repeat(300), mapQuery: "store area" },
      contactMethods: [],
      cta: { headline: "見出し", body: "あ".repeat(300), buttonLabel: "予約する", href: "#contact" },
      seoTitle: "title",
      metaDescription: "description",
      faq: [{ question: "Q", answer: "あ".repeat(300) }],
      instagramCaption: "caption",
      googleBusinessImprovement: [],
      strategy: { strengths: [], challenges: [], targetPersona: "persona", differentiators: [] },
      ...overrides,
    };
  }

  it("長すぎるフィールドを全て上限以内に丸める（生成方式に依らないセーフティネット）", () => {
    const clamped = clampGeneratedContents(makeContents());
    expect(clamped.heroTitle.length).toBeLessThanOrEqual(HERO_TITLE_MAX);
    expect(clamped.heroSubtitle.length).toBeLessThanOrEqual(HERO_SUBTITLE_MAX);
    expect(clamped.concept.length).toBeLessThanOrEqual(BODY_MAX);
    expect(clamped.sections[0].body.length).toBeLessThanOrEqual(BODY_MAX);
    expect(clamped.access.addressHint.length).toBeLessThanOrEqual(BODY_MAX);
    expect(clamped.cta.body.length).toBeLessThanOrEqual(BODY_MAX);
    expect(clamped.faq[0].answer.length).toBeLessThanOrEqual(BODY_MAX);
  });

  it("既に短いフィールドは変更しない", () => {
    const short = makeContents({ heroTitle: "短い見出し", heroSubtitle: "短い補足" });
    const clamped = clampGeneratedContents(short);
    expect(clamped.heroTitle).toBe("短い見出し");
    expect(clamped.heroSubtitle).toBe("短い補足");
  });
});
