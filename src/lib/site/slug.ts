/**
 * slug 払い出し（純関数）。
 * - 店名/エリアから安全なスラッグを作る。日本語はローマ字化できないため
 *   英数のみ抽出＋ハッシュ的サフィックスで衝突を避ける設計。
 * - 既存slug集合を渡せば衝突回避して採番する。
 */

/** 文字列から安全なslugコアを作る（英数・ハイフンのみ）。 */
export function slugifyCore(input: string): string {
  const ascii = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "") // 日本語等の非英数は落ちる
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii;
}

/** 文字列から短い安定サフィックスを生成（決定的・衝突しにくい）。 */
export function shortHash(input: string): string {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

/**
 * slug を生成。core が空（日本語のみ等）の場合は "store" + hash にフォールバック。
 * existing に含まれる場合は連番を付与して衝突回避。
 */
export function generateSlug(
  name: string,
  seed: string,
  existing: Set<string> = new Set()
): string {
  const core = slugifyCore(name);
  const base = core ? `${core}-${shortHash(seed || name)}` : `store-${shortHash(seed || name)}`;
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
