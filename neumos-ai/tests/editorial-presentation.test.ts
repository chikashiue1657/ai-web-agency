import { describe, expect, it } from "vitest";
import { assignPresentation, type PresentationPrimitive } from "@/lib/editorial/presentation";
import { toRenderables } from "@/lib/editorial/renderable";
import type { Artifact, ImageArtifact, TextArtifact } from "@/lib/editorial/artifact";

function img(id: string, sourceOrder: number, overrides: Partial<ImageArtifact> = {}): ImageArtifact {
  return { id, media: "image", sourceOrder, url: `https://example.test/${id}.jpg`, absorbedCount: 0, ...overrides };
}

function txt(id: string, sourceOrder: number, text: string, overrides: Partial<TextArtifact> = {}): TextArtifact {
  return { id, media: "text", sourceOrder, text, charCount: text.length, absorbedCount: 0, ...overrides };
}

const LONG_TEXT = "あ".repeat(150);
const SHORT_TEXT = "短い一文";

describe("assignPresentation", () => {
  it("大きく非極端な縦横比の画像はOccupyになる", () => {
    const artifacts: Artifact[] = [img("i0", 0, { width: 1600, height: 1200 })];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].primitive).toBe("Occupy");
  });

  it("120文字以上のテキストはOccupyになる(直前がOccupyでなければ)", () => {
    const artifacts: Artifact[] = [txt("t0", 0, LONG_TEXT)];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].primitive).toBe("Occupy");
  });

  it("低解像度の画像はOccupyにならない(隣接画像が無ければIsolate)", () => {
    const artifacts: Artifact[] = [img("i0", 0, { width: 400, height: 300 })];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].primitive).toBe("Isolate");
  });

  it("極端な縦横比の画像はOccupyにならない", () => {
    const artifacts: Artifact[] = [img("i0", 0, { width: 3000, height: 400 })];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].primitive).not.toBe("Occupy");
  });

  it("低解像度でも隣接する画像があればSequenceになる", () => {
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 1200 }),
      img("i1", 1, { width: 400, height: 300 }),
    ];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[1].primitive).toBe("Sequence");
  });

  it("短いテキストはSupportになる", () => {
    const artifacts: Artifact[] = [txt("t0", 0, SHORT_TEXT)];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].primitive).toBe("Support");
  });

  it("Pairは今回のRenderable(1 Artifact = 1 Renderable)では発生しない", () => {
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 1200 }),
      txt("t0", 1, LONG_TEXT),
      img("i1", 2, { width: 400, height: 300 }),
    ];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result.some((r) => r.primitive === "Pair")).toBe(false);
  });

  it("不可能な組み合わせ(未定義のPrimitive)は発生しない", () => {
    const valid: PresentationPrimitive[] = ["Occupy", "Sequence", "Isolate", "Support", "Pair"];
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 1200 }),
      txt("t0", 1, LONG_TEXT),
      img("i1", 2, { width: 400, height: 300 }),
      txt("t1", 3, SHORT_TEXT),
    ];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result.every((r) => valid.includes(r.primitive))).toBe(true);
  });

  it("同一Primitiveの不自然な連続を回避する: Occupy適格な大画像が3枚連続すると3枚目はSequenceへ降格する", () => {
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 1200 }),
      img("i1", 1, { width: 1600, height: 1200 }),
      img("i2", 2, { width: 1600, height: 1200 }),
    ];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result.map((r) => r.primitive)).toEqual(["Occupy", "Occupy", "Sequence"]);
  });

  it("同一Primitiveの不自然な連続を回避する: 長文が連続すると2件目はSupportへ降格する", () => {
    const artifacts: Artifact[] = [txt("t0", 0, LONG_TEXT), txt("t1", 1, LONG_TEXT + "追加")];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result.map((r) => r.primitive)).toEqual(["Occupy", "Support"]);
  });

  it("横長・縦長・正方形いずれの画像でもクラッシュせず判定できる", () => {
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 900 }), // 横長
      img("i1", 1, { width: 900, height: 1600 }), // 縦長
      img("i2", 2, { width: 1400, height: 1400 }), // 正方形
    ];
    expect(() => assignPresentation(toRenderables(artifacts))).not.toThrow();
  });

  it("absorbedCountの値に関わらずOccupy判定は解像度・縦横比のみで決まる(指摘2の回帰テスト)", () => {
    const heavy: Artifact[] = [img("i0", 0, { width: 1600, height: 1200, absorbedCount: 20 })];
    const light: Artifact[] = [img("i0", 0, { width: 1600, height: 1200, absorbedCount: 0 })];
    const heavyResult = assignPresentation(toRenderables(heavy));
    const lightResult = assignPresentation(toRenderables(light));
    expect(heavyResult[0].primitive).toBe(lightResult[0].primitive);
  });

  it("reasonsにabsorbedCountが判定根拠として含まれない", () => {
    const artifacts: Artifact[] = [img("i0", 0, { width: 1600, height: 1200, absorbedCount: 9 })];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].reasons.some((r) => r.toLowerCase().includes("absorbed"))).toBe(false);
  });

  it("reasonsで判定根拠を追跡できる", () => {
    const artifacts: Artifact[] = [img("i0", 0, { width: 1600, height: 1200 })];
    const result = assignPresentation(toRenderables(artifacts));
    expect(result[0].reasons.length).toBeGreaterThan(0);
    expect(result[0].reasons.join(" ")).toContain("width=1600");
  });

  it("同じ入力なら同じ結果になる(決定性)", () => {
    const artifacts: Artifact[] = [
      img("i0", 0, { width: 1600, height: 1200 }),
      txt("t0", 1, LONG_TEXT),
      img("i1", 2, { width: 400, height: 300 }),
    ];
    const first = assignPresentation(toRenderables(artifacts));
    const second = assignPresentation(toRenderables(artifacts));
    expect(first.map((r) => r.primitive)).toEqual(second.map((r) => r.primitive));
  });

  it("空配列でも例外を投げない", () => {
    expect(assignPresentation([])).toEqual([]);
  });
});
