/**
 * 編集パイプラインのCompress段。重複除去のみを行う(意味分類・被写体推測はしない)。
 * neumos-ai/docs/design/editorial-pipeline-design.md 7章。
 *
 * 画像・テキストそれぞれ、sourceOrder昇順に1件ずつ走査し、既存クラスタの代表と
 * 近似度が閾値を超えていれば吸収(absorbedCountを加算)、超えなければ新しい
 * クラスタの代表にする、という決定的な単一パスのクラスタリング。
 * クラスタ内の代表は常に「そのクラスタで最初に登場した(=sourceOrderが最小の)」
 * Artifactになる(走査順がsourceOrder昇順のため自然にそうなる)。
 *
 * 画像デコードに失敗した場合(不正なバイト列・フェッチ失敗等)は、
 * パイプライン全体をクラッシュさせず、「畳めない=そのまま独立したクラスタとして
 * 残す」というフォールバックにする。
 */
import { type Artifact, type ImageArtifact, type TextArtifact, isImageArtifact, isTextArtifact } from "./artifact";
import { computeImageHash, fetchImageBuffer, hammingDistance, textJaccardSimilarity } from "./similarity";

export interface CompressResult {
  artifacts: Artifact[];
}

/** 64bit中のハミング距離がこの値以下なら「ほぼ同一画像」として畳む。 */
export const IMAGE_HASH_DISTANCE_THRESHOLD = 5;
/** Jaccard係数がこの値以上なら「ほぼ同一表現」として畳む。 */
export const TEXT_JACCARD_THRESHOLD = 0.92;

interface Cluster<T> {
  representative: T;
  absorbed: number;
}

async function hashOrNull(url: string): Promise<{ hash: bigint; width: number; height: number } | null> {
  try {
    const buffer = await fetchImageBuffer(url);
    return await computeImageHash(buffer);
  } catch {
    return null;
  }
}

async function compressImages(images: readonly ImageArtifact[]): Promise<ImageArtifact[]> {
  if (images.length === 0) return [];

  const hashes = await Promise.all(images.map((img) => hashOrNull(img.url)));

  const clusters: Array<Cluster<ImageArtifact> & { hash: bigint | null }> = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const decoded = hashes[i];
    const withDecodedDims: ImageArtifact = decoded
      ? { ...image, width: decoded.width, height: decoded.height, hash: decoded.hash }
      : { ...image };

    if (decoded === null) {
      clusters.push({ representative: withDecodedDims, absorbed: 0, hash: null });
      continue;
    }

    const match = clusters.find((c) => c.hash !== null && hammingDistance(c.hash, decoded.hash) <= IMAGE_HASH_DISTANCE_THRESHOLD);
    if (match) {
      match.absorbed += 1;
    } else {
      clusters.push({ representative: withDecodedDims, absorbed: 0, hash: decoded.hash });
    }
  }

  return clusters.map((c) => ({ ...c.representative, absorbedCount: c.absorbed }));
}

function compressTexts(texts: readonly TextArtifact[]): TextArtifact[] {
  const clusters: Array<Cluster<TextArtifact>> = [];
  for (const text of texts) {
    const match = clusters.find((c) => textJaccardSimilarity(c.representative.text, text.text) >= TEXT_JACCARD_THRESHOLD);
    if (match) {
      match.absorbed += 1;
    } else {
      clusters.push({ representative: text, absorbed: 0 });
    }
  }
  return clusters.map((c) => ({ ...c.representative, absorbedCount: c.absorbed }));
}

export async function compressArtifacts(editorial: readonly Artifact[]): Promise<CompressResult> {
  const images = editorial.filter(isImageArtifact);
  const texts = editorial.filter(isTextArtifact);

  const [compressedImages, compressedTexts] = await Promise.all([
    compressImages(images),
    Promise.resolve(compressTexts(texts)),
  ]);

  const artifacts = [...compressedImages, ...compressedTexts].sort((a, b) => a.sourceOrder - b.sourceOrder);
  return { artifacts };
}
