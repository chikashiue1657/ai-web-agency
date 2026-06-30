/**
 * 正規化の補助純関数群（欠損値に強い変換ユーティリティ）。
 */
import type { StoreCategory } from "@/lib/types";

/** 任意値を trim 済み文字列 or null に。空文字も null 化。 */
export function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/** 数値化（"1,234件" 等のノイズ除去）。失敗時 null。 */
export function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 整数化（件数系）。負値は0に丸める。null許容。 */
export function toCount(v: unknown): number {
  const n = toNumber(v);
  if (n == null) return 0;
  return Math.max(0, Math.round(n));
}

/** 0〜5 にクランプした評価値。 */
export function toRating(v: unknown): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.min(5, Math.max(0, Math.round(n * 100) / 100));
}

/**
 * 業種文字列を代表カテゴリに正規化（ルールベース）。
 * - Google/Apifyのtypeや日本語業種名の揺れを吸収。
 * - 不明は "other"。
 */
export function normalizeCategory(raw: unknown): StoreCategory {
  const s = (toStr(raw) ?? "").toLowerCase();
  if (!s) return "other";

  const has = (...keys: string[]) => keys.some((k) => s.includes(k));

  if (has("cafe", "カフェ", "coffee", "喫茶")) return "cafe";
  if (has("izakaya", "居酒屋", "bar", "酒場", "バル")) return "izakaya";
  if (
    has(
      "restaurant",
      "food",
      "meal",
      "飲食",
      "食堂",
      "レストラン",
      "そば",
      "ステーキ",
      "焼肉",
      "寿司",
      "ラーメン",
      "沖縄料理"
    )
  )
    return "restaurant";
  if (
    has(
      "beauty",
      "salon",
      "hair",
      "nail",
      "spa",
      "美容",
      "ヘアサロン",
      "ネイル",
      "エステ",
      "理容"
    )
  )
    return "beauty";
  if (
    has(
      "clinic",
      "hospital",
      "dental",
      "dentist",
      "doctor",
      "医院",
      "クリニック",
      "歯科",
      "病院",
      "整骨",
      "整体"
    )
  )
    return "clinic";
  if (has("hotel", "lodging", "guest_house", "ホテル", "宿", "民宿", "旅館"))
    return "hotel";
  if (has("store", "shop", "retail", "小売", "物販", "ショップ", "商店"))
    return "retail";

  return "other";
}

/**
 * 住所からエリア（市町村）を推定（沖縄エリア前提のヒューリスティック）。
 * - 取得できない場合は null（断定しない）。
 */
export function inferArea(address: unknown, explicit?: unknown): string | null {
  const ex = toStr(explicit);
  if (ex) return ex;
  const addr = toStr(address);
  if (!addr) return null;
  // 「○○郡○○町/村」を優先抽出（郡をまたいで市町村を拾わないよう先に判定）
  const gun = addr.match(/郡([一-龥ぁ-んァ-ヶ]+?[町村])/);
  if (gun) return gun[1];
  // 「沖縄県○○市/町/村」を抽出
  const m = addr.match(/沖縄県?\s*([一-龥ぁ-んァ-ヶ]+?[市町村])/);
  if (m) return m[1];
  return null;
}

/** 文字列正規化（近似一致用）: 空白/記号除去・小文字化。 */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[()（）「」【】\-ー–—_,.、。･・]/g, "");
}

/**
 * name + address の近似一致スコア（0〜1）。
 * place_id が無い場合の重複判定に使用（純関数）。
 */
export function similarity(a: string, b: string): number {
  const x = normalizeForMatch(a);
  const y = normalizeForMatch(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Dice係数（2-gram）で軽量に近似一致
  const grams = (str: string) => {
    const g = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const key = str.slice(i, i + 2);
      g.set(key, (g.get(key) ?? 0) + 1);
    }
    return g;
  };
  const ga = grams(x);
  const gb = grams(y);
  if (ga.size === 0 || gb.size === 0) return x === y ? 1 : 0;
  let inter = 0;
  for (const [k, v] of ga) {
    const w = gb.get(k);
    if (w) inter += Math.min(v, w);
  }
  return (2 * inter) / (x.length - 1 + (y.length - 1));
}
