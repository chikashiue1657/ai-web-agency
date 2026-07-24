import { describe, expect, it, beforeEach } from "vitest";
import { runGeneration, GenerationTypeNotImplementedError } from "@/lib/engine";
import { HERO_SUBTITLE_MAX, HERO_TITLE_MAX } from "@/lib/engine/copy-limits";
import type { StoreBrief } from "@/lib/types";

const brief: StoreBrief = {
  storeName: "Salon Umi",
  industry: "美容室",
  area: "浦添市",
  targetCustomer: "20-30代女性",
  mainProblem: "新規集客がSNSに依存し安定しない",
  salesAngle: "髪質改善に特化した技術力",
  websiteGoal: "予約導線の強化",
  siteConcept: "髪と心を整えるサロン",
  recommendedPages: [],
  seoKeywords: ["浦添市 美容室", "髪質改善"],
  tone: "上品・落ち着いた",
  offer: "初回髪質診断無料",
};

describe("engine dispatcher", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it("generates website contents via the rule-based path when no LLM key is configured", async () => {
    const result = await runGeneration("website", brief);
    expect(result.method).toBe("rule");
    expect(result.contents.heroTitle).toContain(brief.storeName);
  });

  it("briefのsalesAngle/targetCustomerが長文でも、ヒーローの見出し・補足は短く収まる（本番実例の回帰テスト）", async () => {
    const longBrief: StoreBrief = {
      ...brief,
      storeName: "BB-Coffee",
      area: "沖縄市",
      salesAngle:
        "HP新規制作による検索流入と予約導線の確立。具体的には世界観の可視化とSNS連携での来店動機づくり／訪日客向け多言語ページを提案。",
      targetCustomer: "沖縄市周辺の地域客＋観光客（訪日客含む）（仮説：要ヒアリングで確定）",
      mainProblem: "店名以外の検索（エリア×業種）から新規客を取りこぼしている",
    };

    const result = await runGeneration("website", longBrief);
    expect(result.contents.heroTitle.length).toBeLessThanOrEqual(HERO_TITLE_MAX);
    expect(result.contents.heroSubtitle.length).toBeLessThanOrEqual(HERO_SUBTITLE_MAX);
    // 見出し・補足・コンセプトのいずれにも内部メモ用の仮説書き（括弧）が漏れ出さないこと
    expect(result.contents.heroTitle).not.toContain("仮説");
    expect(result.contents.heroSubtitle).not.toContain("仮説");
    expect(result.contents.concept).not.toContain("仮説");
    // テンプレートが構造的に付ける括弧自体は壊れていないこと（対応する開き括弧が必ずある）
    expect((result.contents.concept.match(/）/g) ?? []).length).toBe(
      (result.contents.concept.match(/（/g) ?? []).length
    );
  });

  it("throws GenerationTypeNotImplementedError for not-yet-implemented types", async () => {
    await expect(runGeneration("landing_page", brief)).rejects.toBeInstanceOf(
      GenerationTypeNotImplementedError
    );
    await expect(runGeneration("instagram_post", brief)).rejects.toBeInstanceOf(
      GenerationTypeNotImplementedError
    );
  });
});
