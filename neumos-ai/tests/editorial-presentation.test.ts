import { describe, expect, it } from "vitest";
import { assignPresentation, type PresentationPrimitive } from "@/lib/editorial/presentation";
import type { ImageArtifact } from "@/lib/editorial/artifact";

function img(id: string, sourceOrder: number, overrides: Partial<ImageArtifact> = {}): ImageArtifact {
  return { id, media: "image", sourceOrder, url: `https://example.test/${id}.jpg`, absorbedCount: 0, ...overrides };
}

describe("assignPresentation (Gallery専用)", () => {
  it("大きく非極端な縦横比の画像はOccupyになる", () => {
    const result = assignPresentation([img("i0", 0, { width: 1600, height: 1200 })]);
    expect(result[0].primitive).toBe("Occupy");
  });

  it("低解像度の画像は単独ならIsolateになる", () => {
    const result = assignPresentation([img("i0", 0, { width: 400, height: 300 })]);
    expect(result[0].primitive).toBe("Isolate");
  });

  it("極端な縦横比の画像はOccupyにならない", () => {
    const result = assignPresentation([img("i0", 0, { width: 3000, height: 400 })]);
    expect(result[0].primitive).not.toBe("Occupy");
  });

  it("低解像度でも他に写真があればSequenceになる", () => {
    const result = assignPresentation([
      img("i0", 0, { width: 1600, height: 1200 }),
      img("i1", 1, { width: 400, height: 300 }),
    ]);
    expect(result[1].primitive).toBe("Sequence");
  });

  it("不可能な組み合わせ(未定義のPrimitive)は発生しない", () => {
    const valid: PresentationPrimitive[] = ["Occupy", "Sequence", "Isolate"];
    const result = assignPresentation([
      img("i0", 0, { width: 1600, height: 1200 }),
      img("i1", 1, { width: 400, height: 300 }),
      img("i2", 2, { width: 1600, height: 1200 }),
    ]);
    expect(result.every((r) => valid.includes(r.primitive))).toBe(true);
  });

  it("同一Primitiveの不自然な連続を回避する: Occupy適格な大画像が3枚連続すると3枚目はSequenceへ降格する", () => {
    const result = assignPresentation([
      img("i0", 0, { width: 1600, height: 1200 }),
      img("i1", 1, { width: 1600, height: 1200 }),
      img("i2", 2, { width: 1600, height: 1200 }),
    ]);
    expect(result.map((r) => r.primitive)).toEqual(["Occupy", "Occupy", "Sequence"]);
  });

  it("横長・縦長・正方形いずれの画像でもクラッシュせず判定できる", () => {
    const artifacts = [
      img("i0", 0, { width: 1600, height: 900 }),
      img("i1", 1, { width: 900, height: 1600 }),
      img("i2", 2, { width: 1400, height: 1400 }),
    ];
    expect(() => assignPresentation(artifacts)).not.toThrow();
  });

  it("absorbedCountの値に関わらずOccupy判定は解像度・縦横比のみで決まる", () => {
    const heavy = [img("i0", 0, { width: 1600, height: 1200, absorbedCount: 20 })];
    const light = [img("i0", 0, { width: 1600, height: 1200, absorbedCount: 0 })];
    expect(assignPresentation(heavy)[0].primitive).toBe(assignPresentation(light)[0].primitive);
  });

  it("reasonsにabsorbedCountが判定根拠として含まれない", () => {
    const result = assignPresentation([img("i0", 0, { width: 1600, height: 1200, absorbedCount: 9 })]);
    expect(result[0].reasons.some((r) => r.toLowerCase().includes("absorbed"))).toBe(false);
  });

  it("reasonsで判定根拠を追跡できる", () => {
    const result = assignPresentation([img("i0", 0, { width: 1600, height: 1200 })]);
    expect(result[0].reasons.join(" ")).toContain("width=1600");
  });

  it("同じ入力なら同じ結果になる(決定性)", () => {
    const artifacts = [img("i0", 0, { width: 1600, height: 1200 }), img("i1", 1, { width: 400, height: 300 })];
    expect(assignPresentation(artifacts).map((r) => r.primitive)).toEqual(
      assignPresentation(artifacts).map((r) => r.primitive)
    );
  });

  it("空配列でも例外を投げない", () => {
    expect(assignPresentation([])).toEqual([]);
  });
});
