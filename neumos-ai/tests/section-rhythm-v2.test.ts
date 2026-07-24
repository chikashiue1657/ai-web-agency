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
});
