import { describe, expect, it } from "vitest";
import { resolveTheme } from "@/lib/theme";
import { classifyIndustry } from "@/lib/engine/industry";

const SAMPLE_LABELS = {
  cafe: "カフェ",
  hair_salon: "美容室",
  spa: "整体院",
  izakaya: "居酒屋",
  hotel: "ホテル",
  general: "その他",
} as const;

describe("resolveTheme", () => {
  it("業種ごとに異なるテーマ（配色・余白）を返す", () => {
    const themes = Object.values(SAMPLE_LABELS).map((label) => resolveTheme(label));
    const gradients = new Set(themes.map((t) => t.heroGradient));
    // 6カテゴリ全てで異なる配色になっていること（使い回しが無いこと）
    expect(gradients.size).toBe(Object.keys(SAMPLE_LABELS).length);
  });

  it("未分類の業種は general テーマにフォールバックする", () => {
    const theme = resolveTheme("何かよくわからない業種");
    expect(theme).toEqual(resolveTheme(SAMPLE_LABELS.general));
  });

  it("同じ業種カテゴリの表記違いは同じテーマになる", () => {
    expect(resolveTheme("カフェ")).toEqual(resolveTheme("コーヒーショップ"));
    expect(classifyIndustry("カフェ")).toBe(classifyIndustry("コーヒーショップ"));
  });
});
