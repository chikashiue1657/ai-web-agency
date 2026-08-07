import { describe, expect, it } from "vitest";
import { Jimp, rgbaToInt } from "jimp";
import {
  computeImageHash,
  hammingDistance,
  normalizeTextForSimilarity,
  textJaccardSimilarity,
} from "@/lib/editorial/similarity";

const SIZE = 60;
const SQUARE = 10;

/** 10px角のチェッカーボード模様。squareOffsetをずらすと構図が変わる。 */
async function makeCheckerboard(opts: {
  size?: number;
  square?: number;
  brightnessJitter?: (x: number, y: number) => number;
  invert?: boolean;
}): Promise<Buffer> {
  const size = opts.size ?? SIZE;
  const square = opts.square ?? SQUARE;
  const img = new Jimp({ width: size, height: size, color: 0x000000ff });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = (Math.floor(x / square) + Math.floor(y / square)) % 2;
      let v = cell === 0 ? 30 : 220;
      if (opts.invert) v = 255 - v;
      if (opts.brightnessJitter) v = Math.max(0, Math.min(255, v + opts.brightnessJitter(x, y)));
      img.setPixelColor(rgbaToInt(v, v, v, 255), x, y);
    }
  }
  return img.getBuffer("image/png");
}

async function hashOf(buf: Buffer) {
  return (await computeImageHash(buf)).hash;
}

describe("computeImageHash / hammingDistance", () => {
  it("完全同一画像は距離0", async () => {
    const buf = await makeCheckerboard({});
    const a = await hashOf(buf);
    const b = await hashOf(buf);
    expect(hammingDistance(a, b)).toBe(0);
  });

  it("軽微なリサイズ(同じ模様を別解像度で書き出しただけ)は距離が小さい", async () => {
    // 6マス四方のチェッカーボードを解像度違いで書き出す(マス目の絶対px数ではなく、
    // 画像全体に対する比率を揃えることで「同じ写真を別サイズで保存した」を模す)。
    const original = await makeCheckerboard({ size: 60, square: 10 });
    const resized = await makeCheckerboard({ size: 54, square: 9 });
    const a = await hashOf(original);
    const b = await hashOf(resized);
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(5);
  });

  it("軽微な圧縮差(小さなノイズ)は距離が小さい", async () => {
    const original = await makeCheckerboard({});
    const noisy = await makeCheckerboard({ brightnessJitter: (x, y) => (((x * 7 + y) % 5) - 2) });
    const a = await hashOf(original);
    const b = await hashOf(noisy);
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(5);
  });

  it("色味だけわずかに異なる画像(全体的な明度シフト)は距離が小さい", async () => {
    const original = await makeCheckerboard({});
    const shifted = await makeCheckerboard({ brightnessJitter: () => 10 });
    const a = await hashOf(original);
    const b = await hashOf(shifted);
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(5);
  });

  it("構図が明確に異なる画像(反転パターン)は距離が大きい", async () => {
    const original = await makeCheckerboard({});
    const inverted = await makeCheckerboard({ invert: true });
    const a = await hashOf(original);
    const b = await hashOf(inverted);
    expect(hammingDistance(a, b)).toBeGreaterThan(5);
  });

  it("元画像のwidth/heightを返す", async () => {
    const buf = await makeCheckerboard({ size: 42 });
    const result = await computeImageHash(buf);
    expect(result.width).toBe(42);
    expect(result.height).toBe(42);
  });

  it("不正なバイト列では例外を投げる(呼び出し側でフォールバックする前提)", async () => {
    await expect(computeImageHash(Buffer.from("not-an-image"))).rejects.toThrow();
  });
});

describe("textJaccardSimilarity", () => {
  it("完全同一テキストは1", () => {
    expect(textJaccardSimilarity("自家焙煎の深煎りブレンド", "自家焙煎の深煎りブレンド")).toBe(1);
  });

  it("空白・句読点だけ異なるテキストはほぼ1", () => {
    const a = "自家焙煎の深煎りブレンド、香り高い一杯です。";
    const b = "自家焙煎の深煎りブレンド 香り高い一杯です";
    expect(textJaccardSimilarity(a, b)).toBeGreaterThanOrEqual(0.92);
  });

  it("似ているが意味の異なるテキストは閾値未満に収まる", () => {
    const a = "自家焙煎の深煎りブレンドは、しっかりとした苦味とコクが特徴です。";
    const b = "自家焙煎の浅煎りブレンドは、フルーティーな酸味が特徴です。";
    expect(textJaccardSimilarity(a, b)).toBeLessThan(0.92);
  });

  it("全く異なるテキストは低い", () => {
    expect(textJaccardSimilarity("自家焙煎の深煎りブレンド", "月曜定休、駐車場3台あります")).toBeLessThan(0.3);
  });
});

describe("normalizeTextForSimilarity", () => {
  it("全角半角・空白・句読点を正規化する", () => {
    expect(normalizeTextForSimilarity("こんにちは、 世界！")).toBe(normalizeTextForSimilarity("こんにちは世界"));
  });
});
