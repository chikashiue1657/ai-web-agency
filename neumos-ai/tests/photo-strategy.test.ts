import { describe, expect, it } from "vitest";
import { buildPhotoPlan, classifyPhotoTier } from "@/lib/engine/photo-strategy";

describe("classifyPhotoTier", () => {
  it("0枚は none", () => {
    expect(classifyPhotoTier(0)).toBe("none");
  });
  it("1〜2枚は minimal", () => {
    expect(classifyPhotoTier(1)).toBe("minimal");
    expect(classifyPhotoTier(2)).toBe("minimal");
  });
  it("3〜5枚は moderate", () => {
    expect(classifyPhotoTier(3)).toBe("moderate");
    expect(classifyPhotoTier(5)).toBe("moderate");
  });
  it("6枚以上は many", () => {
    expect(classifyPhotoTier(6)).toBe("many");
    expect(classifyPhotoTier(12)).toBe("many");
  });
});

describe("buildPhotoPlan", () => {
  it("photoUrlsが未指定なら none で何も割り当てない", () => {
    const plan = buildPhotoPlan(undefined);
    expect(plan.tier).toBe("none");
    expect(plan.heroPhotoUrl).toBeUndefined();
    expect(plan.storyPhotoUrl).toBeUndefined();
    expect(plan.galleryPhotoUrls).toEqual([]);
  });

  it("1枚なら minimal・その1枚がHeroへ割当てられ、Story/Gallery用は無い（使い回さない）", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg"]);
    expect(plan.tier).toBe("minimal");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrl).toBeUndefined();
    expect(plan.galleryPhotoUrls).toEqual([]);
  });

  it("2枚ならminimal。Hero+Storyで使い切り、Gallery用は空", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
    expect(plan.tier).toBe("minimal");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrl).toBe("https://example.com/b.jpg");
    expect(plan.galleryPhotoUrls).toEqual([]);
  });

  it("3枚ならmoderate。Hero+Storyの後、Gallery用に1枚残る", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"]);
    expect(plan.tier).toBe("moderate");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrl).toBe("https://example.com/b.jpg");
    expect(plan.galleryPhotoUrls).toEqual(["https://example.com/c.jpg"]);
  });

  it("4枚ならmoderate。Hero+Storyを除いた残りが全てGallery用になる", () => {
    const plan = buildPhotoPlan([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/c.jpg",
      "https://example.com/d.jpg",
    ]);
    expect(plan.tier).toBe("moderate");
    expect(plan.galleryPhotoUrls).toHaveLength(2);
  });

  it("6枚以上はmany", () => {
    const plan = buildPhotoPlan(
      Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`)
    );
    expect(plan.tier).toBe("many");
    expect(plan.galleryPhotoUrls).toHaveLength(4);
  });

  it("同じURLが重複していても1枚として扱い、Hero/Story/Galleryで重複表示させない", () => {
    const plan = buildPhotoPlan([
      "https://example.com/a.jpg",
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
    expect(plan.tier).toBe("minimal");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg");
    expect(plan.storyPhotoUrl).toBe("https://example.com/b.jpg");
    expect(plan.galleryPhotoUrls).toEqual([]);
  });

  it("クエリ文字列だけが異なる実質同一URLも重複として扱う", () => {
    const plan = buildPhotoPlan(["https://example.com/a.jpg?v=1", "https://example.com/a.jpg?v=2"]);
    expect(plan.tier).toBe("minimal");
    expect(plan.heroPhotoUrl).toBe("https://example.com/a.jpg?v=1");
    expect(plan.storyPhotoUrl).toBeUndefined();
  });

  it("500枚のような異常データでも、表示に使う総枚数は12枚を超えない(many、上限固定)", () => {
    const plan = buildPhotoPlan(Array.from({ length: 500 }, (_, i) => `https://example.com/${i}.jpg`));
    expect(plan.tier).toBe("many");
    const total = 1 /* hero */ + 1 /* story */ + plan.galleryPhotoUrls.length;
    expect(total).toBeLessThanOrEqual(12);
    expect(plan.galleryPhotoUrls).toHaveLength(10);
  });
});
