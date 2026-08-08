import { describe, expect, it } from "vitest";
import {
  boundingBox,
  centroid,
  polygonArea,
  polygonWithinBounds,
  polygonsIntersect,
  rectanglePoints,
  segmentsIntersect,
  snap,
  transformPolygon,
} from "@/lib/cad/geometry";

describe("polygonArea", () => {
  it("矩形の面積を計算する", () => {
    expect(polygonArea(rectanglePoints(10, 20))).toBe(200);
  });

  it("三角形の面積を計算する", () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe(50);
  });

  it("頂点2つ未満は0", () => {
    expect(polygonArea([{ x: 0, y: 0 }])).toBe(0);
  });
});

describe("centroid / boundingBox", () => {
  it("矩形の重心は中心になる", () => {
    expect(centroid(rectanglePoints(10, 20))).toEqual({ x: 5, y: 10 });
  });

  it("矩形のバウンディングボックス", () => {
    expect(boundingBox(rectanglePoints(10, 20))).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 20 });
  });
});

describe("transformPolygon", () => {
  it("平行移動: 重心が目標座標に一致する", () => {
    const pts = transformPolygon(rectanglePoints(10, 20), { x: 100, y: 50, rotation: 0, mirrored: false });
    expect(centroid(pts).x).toBeCloseTo(100);
    expect(centroid(pts).y).toBeCloseTo(50);
  });

  it("90度回転で幅と高さが入れ替わる", () => {
    const pts = transformPolygon(rectanglePoints(10, 20), { x: 0, y: 0, rotation: 90, mirrored: false });
    const bbox = boundingBox(pts);
    expect(bbox.maxX - bbox.minX).toBeCloseTo(20);
    expect(bbox.maxY - bbox.minY).toBeCloseTo(10);
  });

  it("ミラー後も面積は変わらない", () => {
    const original = rectanglePoints(10, 20);
    const mirrored = transformPolygon(original, { x: 0, y: 0, rotation: 0, mirrored: true });
    expect(polygonArea(mirrored)).toBeCloseTo(polygonArea(original));
  });
});

describe("segmentsIntersect / polygonsIntersect", () => {
  it("交差する線分を検出する", () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }),
    ).toBe(true);
  });

  it("交差しない線分", () => {
    expect(
      segmentsIntersect({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 }, { x: 6, y: 6 }),
    ).toBe(false);
  });

  it("重なる矩形はtrue", () => {
    const a = transformPolygon(rectanglePoints(10, 10), { x: 5, y: 5, rotation: 0, mirrored: false });
    const b = transformPolygon(rectanglePoints(10, 10), { x: 10, y: 10, rotation: 0, mirrored: false });
    expect(polygonsIntersect(a, b)).toBe(true);
  });

  it("離れた矩形はfalse", () => {
    const a = transformPolygon(rectanglePoints(10, 10), { x: 5, y: 5, rotation: 0, mirrored: false });
    const b = transformPolygon(rectanglePoints(10, 10), { x: 100, y: 100, rotation: 0, mirrored: false });
    expect(polygonsIntersect(a, b)).toBe(false);
  });

  it("完全に内包される場合もtrue", () => {
    const outer = rectanglePoints(20, 20);
    const inner = transformPolygon(rectanglePoints(2, 2), { x: 10, y: 10, rotation: 0, mirrored: false });
    expect(polygonsIntersect(outer, inner)).toBe(true);
  });
});

describe("polygonWithinBounds", () => {
  it("範囲内ならtrue", () => {
    expect(polygonWithinBounds(rectanglePoints(10, 10), 20, 20)).toBe(true);
  });

  it("範囲外を含むとfalse", () => {
    const pts = transformPolygon(rectanglePoints(10, 10), { x: 25, y: 5, rotation: 0, mirrored: false });
    expect(polygonWithinBounds(pts, 20, 20)).toBe(false);
  });
});

describe("snap", () => {
  it("指定ステップに丸める", () => {
    expect(snap(12.3, 1)).toBe(12);
    expect(snap(12.6, 1)).toBe(13);
    expect(snap(12.34, 0.5)).toBe(12.5);
  });

  it("step<=0はそのまま", () => {
    expect(snap(12.345, 0)).toBe(12.345);
  });
});
