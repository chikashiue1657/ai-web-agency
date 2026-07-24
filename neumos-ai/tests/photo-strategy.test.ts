import { describe, expect, it } from "vitest";
import { buildPhotoPlan, classifyPhotoTier } from "@/lib/engine/photo-strategy";

describe("classifyPhotoTier", () => {
  it("0枚は none", () => {
    expect(classifyPhotoTier(0)).toBe("none");
  });
  it("1枚は single", () => {
    expect(classifyPhotoTier(1)).toBe("single");
  });
  it("2〜3枚は few", () => {
    expect(classifyPhotoTier(2)).toBe("few");
    expect(classifyPhotoTier(3)).toBe("few");
  });
  it("4枚以上は many", () => {
    expect(classifyPhotoTier(4)).toBe("many");
    expect(classifyPhotoTier(10)).toBe("many");
  });
});

describe("buildPhotoPlan", () => {
  it("photoUrlsが未指定なら none でHero写真も無い", () => {
    const plan = buildPhotoPlan(undefined);
    expect(plan.tier).toBe("none");
    expect(plan.heroPhotoUrl).toBeUndefined();
    expect(plan.storyPhotoUrls).toEqual([]);
  });

  it("1枚なら single・その1枚がHeroへ割当てられ、story用は空", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg"]);
    expect(plan.tier).toBe("single");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrls).toEqual([]);
  });

  it("2〜3枚なら few・先頭がHero、残りがstory用", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
    expect(plan.tier).toBe("few");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrls).toEqual(["https://example.com/b.jpg"]);
  });

  it("4枚以上なら many", () => {
    const plan = buildPhotoPlan([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/c.jpg",
      "https://example.com/d.jpg",
    ]);
    expect(plan.tier).toBe("many");
    expect(plan.storyPhotoUrls).toHaveLength(3);
  });

  it("同じURLが重複していても1枚として扱い、Heroとstoryで重複表示させない", () => {
    const plan = buildPhotoPlan([
      "https://example.com/a.jpg",
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
    expect(plan.tier).toBe("few");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrls).toEqual(["https://example.com/b.jpg"]);
  });
});
