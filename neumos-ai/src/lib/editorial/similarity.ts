/**
 * 編集パイプラインの類似度計算(純関数群)。Compress(重複除去)とArrange(並び順)の
 * 両方から共有される。neumos-ai/docs/design/editorial-pipeline-design.md 7章・8章。
 *
 * 画像: dHash(差分ハッシュ)。9x8グレースケールへリサイズし、隣接ピクセルの
 * 明度差の符号から64bitのハッシュを作る。意味分類・被写体推測は一切行わない
 * (「ほぼ同一の画像か」だけを判定できるアルゴリズムであり、それ以上のことは
 * 判定できない、という設計上の限界を明示するために手実装している)。
 *
 * テキスト: 正規化(NFKC + 空白/句読点除去)後の文字2-gram Jaccard係数。
 */
import { Jimp } from "jimp";

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

export interface ImageHashResult {
  hash: bigint;
  width: number;
  height: number;
}

/**
 * 画像バイト列からdHashを計算する。デコードに失敗した場合は例外を投げる
 * (呼び出し側でtry/catchし、「畳めない=そのまま残す」というフォールバックに
 * するのはcompress.tsの責務)。
 */
export async function computeImageHash(buffer: Buffer): Promise<ImageHashResult> {
  const image = await Jimp.fromBuffer(buffer);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  const resized = image.clone().resize({ w: HASH_WIDTH, h: HASH_HEIGHT }).greyscale();

  let hash = 0n;
  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = resized.getPixelColor(x, y) >>> 24; // greyscale後はR=G=B、上位バイトを明度として使う
      const right = resized.getPixelColor(x + 1, y) >>> 24;
      hash = (hash << 1n) | (left < right ? 1n : 0n);
    }
  }

  return { hash, width, height };
}

/** 2つの64bitハッシュのハミング距離(異なるビット数)。 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * 実データの写真URL(既にbrief.realData.photoUrlsに実在すると確認済みのもの)
 * のみをフェッチする想定。任意の外部URLを新たにフェッチしない(SSRF対策)。
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchImageBuffer: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** NFKC正規化 + 空白・句読点(日本語含む)を除去する。 */
export function normalizeTextForSimilarity(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s　、。,.！!？?・「」『』（）()【】\[\]:：;；]/g, "")
    .toLowerCase();
}

function charBigrams(text: string): Set<string> {
  const bigrams = new Set<string>();
  if (text.length < 2) {
    if (text.length === 1) bigrams.add(text);
    return bigrams;
  }
  for (let i = 0; i < text.length - 1; i++) {
    bigrams.add(text.slice(i, i + 2));
  }
  return bigrams;
}

/** 正規化後の文字2-gram Jaccard係数(0〜1)。1に近いほど似ている。 */
export function textJaccardSimilarity(a: string, b: string): number {
  const normA = normalizeTextForSimilarity(a);
  const normB = normalizeTextForSimilarity(b);
  if (normA === normB) return 1;

  const bigramsA = charBigrams(normA);
  const bigramsB = charBigrams(normB);
  if (bigramsA.size === 0 && bigramsB.size === 0) return normA === normB ? 1 : 0;

  let intersection = 0;
  for (const gram of bigramsA) {
    if (bigramsB.has(gram)) intersection++;
  }
  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
