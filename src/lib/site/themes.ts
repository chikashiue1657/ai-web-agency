/**
 * 業種別テンプレート/テーマ定義。
 * - 業種 → 推奨テーマ群 と ブランドカラー・トーンを定義。
 * - 拡張しやすいようテーブル化。将来CMSのテーマ選択UIに流用可能。
 */
import type { StoreCategory } from "@/lib/types";

export type ThemeType =
  // 飲食
  | "washoku" // 和風
  | "modern" // モダン
  | "resort" // リゾート
  // 美容
  | "clean" // 清潔感
  | "luxury" // 高級感
  | "natural" // ナチュラル
  // 医療
  | "trust" // 信頼感
  // 汎用
  | "standard";

export interface ThemeDef {
  type: ThemeType;
  label: string;
  brandColor: string; // 主要色（仮サイトの基調）
  tone: string; // 文章トーン
}

export const THEMES: Record<ThemeType, ThemeDef> = {
  washoku: { type: "washoku", label: "和風", brandColor: "#7c3a1d", tone: "落ち着いた・伝統的" },
  modern: { type: "modern", label: "モダン", brandColor: "#111827", tone: "洗練・都会的" },
  resort: { type: "resort", label: "リゾート", brandColor: "#0ea5e9", tone: "開放的・南国" },
  clean: { type: "clean", label: "清潔感", brandColor: "#06b6d4", tone: "清潔・親しみ" },
  luxury: { type: "luxury", label: "高級感", brandColor: "#1f2937", tone: "上質・特別感" },
  natural: { type: "natural", label: "ナチュラル", brandColor: "#65a30d", tone: "自然体・やわらかい" },
  trust: { type: "trust", label: "信頼感", brandColor: "#1d4ed8", tone: "誠実・安心" },
  standard: { type: "standard", label: "スタンダード", brandColor: "#2563eb", tone: "中立・実務的" },
};

/** 業種ごとの推奨テーマ（先頭が既定）。 */
const CATEGORY_THEMES: Record<StoreCategory, ThemeType[]> = {
  restaurant: ["washoku", "modern", "resort"],
  cafe: ["natural", "modern", "resort"],
  izakaya: ["washoku", "modern"],
  beauty: ["clean", "luxury", "natural"],
  clinic: ["trust", "clean"],
  hotel: ["resort", "luxury", "modern"],
  retail: ["modern", "standard"],
  other: ["standard"],
};

/**
 * 業種と任意のヒント（リゾート立地/高級志向 等）からテーマを選ぶ。
 * 明示指定があればそれを優先。
 */
export function pickTheme(
  category: StoreCategory | string | null | undefined,
  opts?: { explicit?: ThemeType; tourist?: boolean }
): ThemeDef {
  if (opts?.explicit && THEMES[opts.explicit]) return THEMES[opts.explicit];
  const cat = (category as StoreCategory) ?? "other";
  const candidates = CATEGORY_THEMES[cat] ?? CATEGORY_THEMES.other;
  // 観光需要が高い飲食/宿泊は resort を優先
  if (opts?.tourist && candidates.includes("resort")) return THEMES.resort;
  return THEMES[candidates[0]];
}

export function listThemesForCategory(
  category: StoreCategory | string | null | undefined
): ThemeDef[] {
  const cat = (category as StoreCategory) ?? "other";
  return (CATEGORY_THEMES[cat] ?? CATEGORY_THEMES.other).map((t) => THEMES[t]);
}
