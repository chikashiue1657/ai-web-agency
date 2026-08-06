import { describe, expect, it } from "vitest";
import { toRenderables } from "@/lib/editorial/renderable";
import type { Artifact, ImageArtifact, TextArtifact } from "@/lib/editorial/artifact";

function img(id: string, sourceOrder: number): ImageArtifact {
  return { id, media: "image", sourceOrder, url: `https://example.test/${id}.jpg`, absorbedCount: 0 };
}

function txt(id: string, sourceOrder: number, text = "テキスト"): TextArtifact {
  return { id, media: "text", sourceOrder, text, charCount: text.length, absorbedCount: 0 };
}

describe("toRenderables", () => {
  it("恒等変換: 件数・順序が保たれる", () => {
    const artifacts: Artifact[] = [img("i0", 0), txt("t0", 1), img("i1", 2)];
    const renderables = toRenderables(artifacts);
    expect(renderables).toHaveLength(3);
    expect(renderables.map((r) => r.artifacts[0].id)).toEqual(["i0", "t0", "i1"]);
  });

  it("mediaはartifacts[0].mediaと一致する", () => {
    const artifacts: Artifact[] = [img("i0", 0), txt("t0", 1)];
    const renderables = toRenderables(artifacts);
    expect(renderables[0].media).toBe("image");
    expect(renderables[1].media).toBe("text");
  });

  it("sourceOrderが正しく引き継がれる", () => {
    const artifacts: Artifact[] = [img("i0", 5), txt("t0", 9)];
    const renderables = toRenderables(artifacts);
    expect(renderables[0].sourceOrder).toBe(5);
    expect(renderables[1].sourceOrder).toBe(9);
  });

  it("intentは常に'none'(今回の実装範囲の回帰テスト)", () => {
    const artifacts: Artifact[] = [img("i0", 0), txt("t0", 1)];
    const renderables = toRenderables(artifacts);
    expect(renderables.every((r) => r.intent === "none")).toBe(true);
  });

  it("空配列でも例外を投げない", () => {
    expect(toRenderables([])).toEqual([]);
  });

  it("元のartifacts配列を変更しない", () => {
    const artifacts: Artifact[] = [img("i0", 0)];
    const snapshot = JSON.parse(JSON.stringify(artifacts));
    toRenderables(artifacts);
    expect(artifacts).toEqual(snapshot);
  });
});
