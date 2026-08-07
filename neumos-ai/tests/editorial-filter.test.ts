import { describe, expect, it } from "vitest";
import { filterGalleryArtifacts } from "@/lib/editorial/filter";

describe("filterGalleryArtifacts", () => {
  it("空配列を渡すと空配列を返す", () => {
    expect(filterGalleryArtifacts([])).toEqual([]);
  });

  it("空文字列・空白のみのURLを除外する", () => {
    const result = filterGalleryArtifacts(["https://example.test/a.jpg", "", "   "]);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.test/a.jpg");
  });

  it("各URLをImageArtifactへ変換し、sourceOrderが抽出順になる", () => {
    const urls = ["https://example.test/a.jpg", "https://example.test/b.jpg"];
    const result = filterGalleryArtifacts(urls);
    expect(result).toEqual([
      { id: "gallery-photo:0", media: "image", sourceOrder: 0, url: urls[0], absorbedCount: 0 },
      { id: "gallery-photo:1", media: "image", sourceOrder: 1, url: urls[1], absorbedCount: 0 },
    ]);
  });

  it("同じ入力なら同じ出力になる(決定性)", () => {
    const urls = ["https://example.test/a.jpg", "https://example.test/b.jpg"];
    expect(filterGalleryArtifacts(urls)).toEqual(filterGalleryArtifacts(urls));
  });

  it("元の配列を変更しない", () => {
    const urls = ["https://example.test/a.jpg"];
    const snapshot = [...urls];
    filterGalleryArtifacts(urls);
    expect(urls).toEqual(snapshot);
  });
});
