/**
 * v2で実際に表示する写真配列を選び出す（純関数・副作用なし）。
 *
 * `StoreRealData.photoUrls`（実データ）は生成元の情報として一切変更せず、
 * ここでは「表示用に選抜した結果」だけを新しい配列として返す。呼び出し側は
 * 元の`photoUrls`をそのまま保持しつつ、v2の描画にはこの関数の戻り値
 * （`selected`）だけを渡す。
 *
 * 行うのは以下の2点のみ：
 *  1. クエリ文字列だけが異なる実質同一URLの重複排除（出現順維持）
 *  2. 上限（既定12枚）を超える場合の均等サンプリング
 * 画像デコード・知覚的類似度判定・外部API（Vision等）は一切使わない
 * （追加費用ゼロ・外部API不使用という既定方針を守るため、URL文字列の
 * 正規化比較だけを「実質同一画像」の判定基準にする）。
 */

export const DEFAULT_MAX_DISPLAY_PHOTOS = 12;

export interface PhotoSelectionResult {
  /** 実際に表示に使う配列（上限適用後）。 */
  selected: string[];
  /** 呼び出し時に渡された元配列の件数（重複排除前）。 */
  totalInput: number;
  /** 重複排除後・上限適用前の件数。 */
  totalAfterDedup: number;
  /** 上限超過により選抜が発生したか。 */
  truncated: boolean;
  /** 今回適用した上限値。 */
  maxAllowed: number;
}

/**
 * URLを「オリジン+パス名」だけに正規化する。クエリ文字列・フラグメントは
 * 実質同一画像の判定に使わないため取り除く（同じ画像を指すが`?v=1`のような
 * キャッシュバスター等だけが異なるURLを重複として扱うため）。
 * 不正なURL文字列（相対パス等でnew URL()が例外を投げる場合）は、
 * パイプライン全体をクラッシュさせないよう、`?`/`#`より前の部分をそのまま
 * 正規化キーとして使うフォールバックにする。
 */
export function canonicalizePhotoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

/** クエリ文字列だけが異なる実質同一URLを除き、出現順を維持したまま重複排除する。 */
export function dedupePhotoUrls(urls: readonly string[]): string[] {
  const seenCanonical = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const canonical = canonicalizePhotoUrl(url);
    if (seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);
    result.push(url);
  }
  return result;
}

/**
 * 重複排除済み配列から`max`件を均等サンプリングで抽出する。
 * 先頭切り捨てではなく、配列全体に均等に分布したインデックスを選ぶことで、
 * 大量の写真が入力されても「厳選されたギャラリー」に見える構成にする。
 * 0番目（最初の写真）とlength-1番目（最後の写真）は`max>=2`であれば必ず含む。
 */
function sampleEvenly(urls: readonly string[], max: number): string[] {
  if (max <= 0) return [];
  if (urls.length <= max) return [...urls];
  if (max === 1) return [urls[0]];

  const lastIndex = urls.length - 1;
  const indices = new Set<number>();
  for (let i = 0; i < max; i++) {
    const t = i / (max - 1);
    indices.add(Math.round(t * lastIndex));
  }
  // 丸め込みでインデックスが重複し、選抜数がmaxに届かない場合のみ、
  // 未使用の若いインデックスから順に補充する（極端に短い配列との際どい境界向けの保険）。
  let cursor = 0;
  while (indices.size < max && cursor <= lastIndex) {
    if (!indices.has(cursor)) indices.add(cursor);
    cursor++;
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((i) => urls[i]);
}

/**
 * v2表示用の写真配列を選抜する。`rawUrls`（元データ）は変更しない。
 * 戻り値の`truncated`で上限超過の有無、`totalAfterDedup`で重複排除後の
 * 実件数を呼び出し側が確認できる。
 */
export function selectDisplayPhotos(
  rawUrls: readonly string[] | undefined,
  max: number = DEFAULT_MAX_DISPLAY_PHOTOS
): PhotoSelectionResult {
  const input = rawUrls ?? [];
  const deduped = dedupePhotoUrls(input);
  const selected = sampleEvenly(deduped, max);

  return {
    selected,
    totalInput: input.length,
    totalAfterDedup: deduped.length,
    truncated: deduped.length > max,
    maxAllowed: max,
  };
}
