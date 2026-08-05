/**
 * 決定論的な文字列ハッシュ（純関数）。
 *
 * 写真選抜・アートディレクション判定など、「同じ入力なら毎回同じ結果」が
 * 要件になる箇所で共通利用する。乱数生成・現在時刻取得など非決定的な値には
 * 一切依存しない（同じ`seed`を渡せば、プロセスや実行タイミングに関わらず
 * 常に同じ数値を返す）。
 *
 * アルゴリズムはFNV-1a（32bit）。暗号学的な強度は不要で、入力文字列の
 * わずかな違いでも出力が大きく変わる（アバランシュ性が高い）ことだけが
 * 目的のため、実装が小さく依存ゼロのFNV-1aを採用した。
 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 0以上の32bit整数を返す。同じ`seed`には常に同じ値を返す。 */
export function stableHash(seed: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** `seed`から`[0, length)`の範囲のインデックスを決定論的に選ぶ。 */
export function hashToIndex(seed: string, length: number): number {
  if (length <= 0) {
    throw new Error("hashToIndex: length は正の整数である必要があります");
  }
  return stableHash(seed) % length;
}
