import { describe, it, expect } from "vitest";
import { scoreByRules } from "@/lib/scoring";

describe("scoreByRules", () => {
  it("HPなし・高評価・口コミ多数・SNSあり → A", () => {
    const r = scoreByRules({
      category: "restaurant",
      rating: 4.6,
      review_count: 300,
      photo_count: 2,
      has_website: false,
      instagram_url: "https://instagram.com/x",
      opening_hours: { weekday_text: ["月 9-18"] },
    });
    expect(r.priority_rank).toBe("A");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.sales_angle).toContain("予約");
  });

  it("HPあり・評価低め・口コミ少 → C寄り", () => {
    const r = scoreByRules({
      category: "other",
      rating: 3.2,
      review_count: 3,
      photo_count: 20,
      has_website: true,
    });
    expect(r.score).toBeLessThan(45);
    expect(r.priority_rank).toBe("C");
    expect(r.risk_flags.length).toBeGreaterThan(0);
  });

  it("説明可能: reasonsにHP未整備が含まれる", () => {
    const r = scoreByRules({ has_website: false });
    expect(r.reasons.join("")).toContain("ホームページ未整備");
  });

  it("スコアは0〜100にクランプされる", () => {
    const r = scoreByRules({
      category: "hotel",
      rating: 5,
      review_count: 9999,
      photo_count: 0,
      has_website: false,
      instagram_url: "https://instagram.com/x",
      facebook_url: "https://facebook.com/x",
      opening_hours: { weekday_text: ["毎日"] },
      tourist_demand: true,
      multilingual_need: true,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.method).toBe("rule");
  });
});
