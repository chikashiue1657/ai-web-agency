import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hashToIndex, stableHash } from "@/lib/engine/deterministic-hash";

describe("stableHash", () => {
  it("同じ文字列には常に同じ値を返す", () => {
    const seed = "テスト珈琲 検証店 / 東京都渋谷区";
    const first = stableHash(seed);
    const second = stableHash(seed);
    const third = stableHash(seed);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it("常に0以上の整数を返す", () => {
    expect(Number.isInteger(stableHash("店舗A"))).toBe(true);
    expect(stableHash("店舗A")).toBeGreaterThanOrEqual(0);
    expect(stableHash("")).toBeGreaterThanOrEqual(0);
  });

  it("異なる文字列がすべて同じ値へ偏らない", () => {
    const seeds = Array.from({ length: 50 }, (_, i) => `店舗-${i}-${"あ".repeat(i % 5)}`);
    const hashes = new Set(seeds.map((s) => stableHash(s)));
    // 50件中、大多数が異なる値になっていること（衝突が支配的でない）を確認する。
    expect(hashes.size).toBeGreaterThan(45);
  });

  it("先頭が同じでもわずかな違いで異なる値になる(アバランシュ性)", () => {
    expect(stableHash("カフェA")).not.toBe(stableHash("カフェB"));
    expect(stableHash("カフェ")).not.toBe(stableHash("かふぇ"));
  });

  it("Math.random・Date.nowに依存しない実装である", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/engine/deterministic-hash.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
  });
});

describe("hashToIndex", () => {
  it("常に[0, length)の範囲に収まる", () => {
    for (let i = 0; i < 30; i++) {
      const index = hashToIndex(`seed-${i}`, 7);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(7);
    }
  });

  it("同じ入力には常に同じインデックスを返す", () => {
    expect(hashToIndex("店舗A", 5)).toBe(hashToIndex("店舗A", 5));
  });

  it("length<=0はエラーになる", () => {
    expect(() => hashToIndex("seed", 0)).toThrow();
    expect(() => hashToIndex("seed", -1)).toThrow();
  });
});
