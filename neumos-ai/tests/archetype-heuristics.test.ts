import { describe, expect, it } from "vitest";
import {
  PLAUSIBLE_ARCHETYPES_BY_INDUSTRY,
  deriveArchetypeDecision,
} from "@/lib/brand-director/archetype-heuristics";
import type { StoreBrief } from "@/lib/types";

function makeBrief(overrides: Partial<StoreBrief> = {}): StoreBrief {
  return {
    storeName: "テスト珈琲",
    industry: "カフェ",
    area: "東京都渋谷区",
    targetCustomer: "近隣で働く20〜40代",
    mainProblem: "認知不足",
    salesAngle: "自家焙煎の豆",
    websiteGoal: "来店予約を増やす",
    siteConcept: "落ち着いた空間",
    recommendedPages: ["トップ"],
    seoKeywords: ["カフェ"],
    tone: "落ち着いた",
    offer: "10%オフ",
    ...overrides,
  };
}

describe("deriveArchetypeDecision", () => {
  it("同じbrief・同じseedでは常に同じ結果を返す", () => {
    const brief = makeBrief();
    const first = deriveArchetypeDecision(brief, "テスト珈琲:東京都渋谷区");
    const second = deriveArchetypeDecision(brief, "テスト珈琲:東京都渋谷区");
    expect(first).toEqual(second);
  });

  it("toneやsiteConceptを変えると結果が変わり得る", () => {
    const artisanLeaning = deriveArchetypeDecision(
      makeBrief({ tone: "丁寧", salesAngle: "自家焙煎の豆と手仕事", siteConcept: "職人のクラフト感" }),
      "seed-a"
    );
    const luxuryLeaning = deriveArchetypeDecision(
      makeBrief({
        industry: "ホテル",
        tone: "上質",
        salesAngle: "特別な非日常のひととき",
        siteConcept: "静寂に包まれるラグジュアリーな滞在",
      }),
      "seed-a"
    );
    expect(artisanLeaning.archetype).not.toBe(luxuryLeaning.archetype);
  });

  it("業種ごとの妥当集合から逸脱しない(全業種を機械的に確認)", () => {
    const industries: Array<[string, string]> = [
      ["カフェ", "cafe"],
      ["美容室", "hair_salon"],
      ["整体院", "spa"],
      ["居酒屋", "izakaya"],
      ["ホテル", "hotel"],
      ["工務店", "general"],
    ];
    const toneVariants = ["高級", "元気", "癒し", "伝統", "温かい", "シンプル", "なし"];

    for (const [industryLabel, category] of industries) {
      for (const tone of toneVariants) {
        const decision = deriveArchetypeDecision(
          makeBrief({ industry: industryLabel, tone, salesAngle: tone, siteConcept: tone }),
          `${industryLabel}-${tone}`
        );
        expect(PLAUSIBLE_ARCHETYPES_BY_INDUSTRY[category as keyof typeof PLAUSIBLE_ARCHETYPES_BY_INDUSTRY]).toContain(
          decision.archetype
        );
      }
    }
  });

  it("キーワードが一致した場合、根拠(matchedKeywords)が返り、fallbackにはならない", () => {
    const decision = deriveArchetypeDecision(
      makeBrief({ salesAngle: "自家焙煎の豆と丁寧な手仕事" }),
      "seed-keyword"
    );
    expect(decision.usedFallback).toBe(false);
    expect(decision.matchedKeywords.length).toBeGreaterThan(0);
  });

  it("キーワードが1つも一致しない場合のみfallbackになる", () => {
    const decision = deriveArchetypeDecision(
      makeBrief({
        tone: "",
        salesAngle: "",
        siteConcept: "",
        offer: "",
        targetCustomer: "",
        storeName: "テスト店",
        area: "",
      }),
      "seed-empty"
    );
    expect(decision.usedFallback).toBe(true);
    expect(decision.matchedKeywords).toEqual([]);
    // fallback時もPLAUSIBLE集合の範囲内であること。
    expect(PLAUSIBLE_ARCHETYPES_BY_INDUSTRY.cafe).toContain(decision.archetype);
  });

  it("fallback(無得点)時の選択もseedが違えば決定論的に変わりうる", () => {
    const emptyBrief = makeBrief({ tone: "", salesAngle: "", siteConcept: "", offer: "", targetCustomer: "" });
    const results = new Set(
      ["店A", "店B", "店C", "店D", "店E", "店F", "店G", "店H"].map(
        (seed) => deriveArchetypeDecision(emptyBrief, seed).archetype
      )
    );
    // 全て同じ1候補に固定されているわけではない(ハッシュtie-breakが機能している)ことを確認する。
    expect(results.size).toBeGreaterThan(1);
  });

  it("同じ入力に対するtie-break結果は決定論的(再実行しても同じ)", () => {
    const emptyBrief = makeBrief({ tone: "", salesAngle: "", siteConcept: "", offer: "", targetCustomer: "" });
    const a = deriveArchetypeDecision(emptyBrief, "固定シード");
    const b = deriveArchetypeDecision(emptyBrief, "固定シード");
    expect(a.archetype).toBe(b.archetype);
    expect(a.paletteHint).toBe(b.paletteHint);
  });

  it("paletteHintは4値のいずれかを返す", () => {
    const decision = deriveArchetypeDecision(makeBrief(), "seed-palette");
    expect(["warm", "cool", "neutral", "high-contrast"]).toContain(decision.paletteHint);
  });
});
