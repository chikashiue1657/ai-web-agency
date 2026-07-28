import { describe, expect, it } from "vitest";
import { getSectionGapClass } from "@/lib/engine/section-rhythm-v2";

describe("getSectionGapClass", () => {
  it("先頭ブロック（prev=null）は余白を追加しない", () => {
    expect(getSectionGapClass(null, "hero")).toBe("");
  });

  it("Hero→Storyは大きな間隔を返す", () => {
    expect(getSectionGapClass("hero", "story")).toContain("220px");
  });

  it("Story→Galleryは詰めた間隔を返す", () => {
    expect(getSectionGapClass("story", "photoStory")).toContain("120px");
  });

  it("Access→CTAは最大の間隔を返す", () => {
    expect(getSectionGapClass("accessHours", "cta")).toContain("320px");
  });

  it("定義済みの遷移ペアはどれも同一の値を使い回さない（リズムの単調さを避ける）", () => {
    const pairs: [string, string][] = [
      ["hero", "story"],
      ["signature", "story"],
      ["story", "photoStory"],
      ["story", "menu"],
      ["photoStory", "menu"],
      ["menu", "trust"],
      ["trust", "accessHours"],
      ["accessHours", "cta"],
    ];
    const values = pairs.map(([p, n]) => getSectionGapClass(p as never, n as never));
    expect(new Set(values).size).toBe(values.length);
  });

  it("rhythm省略時は既定の'staggered'と完全に同一の値を返す（後方互換）", () => {
    expect(getSectionGapClass("hero", "story")).toBe(getSectionGapClass("hero", "story", "staggered"));
    expect(getSectionGapClass("accessHours", "cta")).toBe(getSectionGapClass("accessHours", "cta", "staggered"));
  });

  it("rhythm='airy'はstaggeredより大きい値を返す", () => {
    const staggered = getSectionGapClass("hero", "story", "staggered");
    const airy = getSectionGapClass("hero", "story", "airy");
    const staggeredPx = Number(staggered.match(/mt-\[(\d+)px\]/)?.[1]);
    const airyPx = Number(airy.match(/mt-\[(\d+)px\]/)?.[1]);
    expect(airyPx).toBeGreaterThan(staggeredPx);
  });

  it("rhythm='dense'はstaggeredより小さい値を返す", () => {
    const staggered = getSectionGapClass("hero", "story", "staggered");
    const dense = getSectionGapClass("hero", "story", "dense");
    const staggeredPx = Number(staggered.match(/mt-\[(\d+)px\]/)?.[1]);
    const densePx = Number(dense.match(/mt-\[(\d+)px\]/)?.[1]);
    expect(densePx).toBeLessThan(staggeredPx);
  });

  it("遷移テーブルに無い組み合わせでも、rhythmごとに異なる既定値を返す（保険用フォールバック）", () => {
    const airy = getSectionGapClass("signature" as never, "cta" as never, "airy");
    const dense = getSectionGapClass("signature" as never, "cta" as never, "dense");
    expect(airy).not.toBe(dense);
  });
});
