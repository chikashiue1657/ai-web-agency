/**
 * 衣料品パターンレイアウトCAD — 純粋な幾何計算関数。
 * すべて cm 単位・平面座標（原点は生地シート左上、下方向が生地の長さ方向）。
 */
import type { Point } from "./types";

export type Placement2D = {
  x: number;
  y: number;
  rotation: number;
  mirrored: boolean;
};

/** 多角形の重心（頂点平均。厳密な面積重心ではないが表示・回転軸として十分な近似）。 */
export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** シューレース公式による多角形面積（cm²、常に非負）。 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function boundingBox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** 幅・高さ矩形の頂点（左上原点）を生成する。 */
export function rectanglePoints(width: number, height: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
}

/**
 * 型紙ローカル座標を配置情報にもとづき絶対座標へ変換する。
 * 変換順序: (必要なら) 左右反転 → 回転 → 重心を placement.x,y へ平行移動。
 */
export function transformPolygon(points: Point[], placement: Placement2D): Point[] {
  const c = centroid(points);
  const rad = (placement.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => {
    const lx = (placement.mirrored ? -1 : 1) * (p.x - c.x);
    const ly = p.y - c.y;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    return { x: rx + placement.x, y: ry + placement.y };
  });
}

function orientation(p: Point, q: Point, r: Point): 0 | 1 | 2 {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(val) < 1e-9) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    q.x >= Math.min(p.x, r.x) - 1e-9 &&
    q.y <= Math.max(p.y, r.y) + 1e-9 &&
    q.y >= Math.min(p.y, r.y) - 1e-9
  );
}

/** 線分 p1-q1 と p2-q2 が交差するか（端点接触も含む）。 */
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/** レイキャスティングによる点の多角形内包判定。 */
export function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 2つの単純多角形が重なっているか判定する（辺同士の交差、または一方が他方に内包されるケース）。
 * 凹多角形にも概ね対応。裁断レイアウトの重なり警告表示用途で厳密な数理保証は不要な前提。
 */
export function polygonsIntersect(a: Point[], b: Point[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  if (a.length >= 3 && pointInPolygon(a[0], b)) return true;
  if (b.length >= 3 && pointInPolygon(b[0], a)) return true;
  return false;
}

/** 多角形の全頂点が幅 width・高さ height の矩形（原点0,0起点）に収まっているか。 */
export function polygonWithinBounds(points: Point[], width: number, height: number): boolean {
  const eps = 1e-6;
  return points.every((p) => p.x >= -eps && p.x <= width + eps && p.y >= -eps && p.y <= height + eps);
}

/** 値を step 単位でスナップする（step<=0 の場合はそのまま）。 */
export function snap(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}
