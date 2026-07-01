import { describe, expect, it, beforeEach } from "vitest";
import { runGeneration, GenerationTypeNotImplementedError } from "@/lib/engine";
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

  it("throws GenerationTypeNotImplementedError for not-yet-implemented types", async () => {
    await expect(runGeneration("landing_page", brief)).rejects.toBeInstanceOf(
      GenerationTypeNotImplementedError
    );
    await expect(runGeneration("instagram_post", brief)).rejects.toBeInstanceOf(
      GenerationTypeNotImplementedError
    );
  });
});
