/**
 * Gallery専用のPresentation段。ページ全体のレイアウトには使わない
 * (neumos-ai/docs/design/editorial-pipeline-design.mdはページ全体Rendererを
 * 前提にしていたが、実際のデザイン品質レビューの結果、その用途を撤回した。
 * PhotoStoryV2(Gallery)内部の構図判定にのみ使う「写真編集ユーティリティ」
 * として位置付け直す)。
 *
 * Renderable層は削除した。将来複数Artifactを束ねる必要が生じた時点で
 * 改めて設計する(現時点では中継オブジェクトでしかなく価値を生んでいなかった)。
 *
 * 判定に使うのは解像度・縦横比・隣接関係・連続数のみ。absorbedCount(撮影枚数)
 * は使わない(「撮影枚数の多さ」と「情報としての重要度」を混同しないため)。
 */
import { type ImageArtifact } from "./artifact";

export type PresentationPrimitive = "Occupy" | "Sequence" | "Isolate";

export interface PresentedImage {
  artifact: ImageArtifact;
  primitive: PresentationPrimitive;
  /** テスト・デバッグ用: なぜこのPrimitiveになったかの根拠トレース。 */
  reasons: string[];
}

/** Occupy(大きな1枚)の技術的な適格条件: 解像度。低解像度の画像を無理に拡大しない。 */
const OCCUPY_MIN_WIDTH = 1200;
/** 同一Primitiveがこの件数連続したら次を降格する。 */
const MAX_SAME_PRIMITIVE_RUN = 2;

function isExtremeAspectRatio(width?: number, height?: number): boolean {
  if (!width || !height) return true; // 不明な場合はOccupy不適格側に倒す(安全側)
  const ratio = width / height;
  return ratio > 3 || ratio < 1 / 3;
}

function countTrailingRun(results: readonly PresentedImage[], primitive: PresentationPrimitive): number {
  let run = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].primitive === primitive) run++;
    else break;
  }
  return run;
}

export function assignPresentation(ordered: readonly ImageArtifact[]): PresentedImage[] {
  const results: PresentedImage[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const artifact = ordered[i];
    const reasons: string[] = [];
    const { width, height } = artifact;
    const extreme = isExtremeAspectRatio(width, height);
    const sizeOk = (width ?? 0) >= OCCUPY_MIN_WIDTH;
    reasons.push(`width=${width ?? "unknown"}`, `aspectExtreme=${extreme}`);

    let primitive: PresentationPrimitive;
    if (sizeOk && !extreme) {
      const trailingOccupyRun = countTrailingRun(results, "Occupy");
      if (trailingOccupyRun >= MAX_SAME_PRIMITIVE_RUN) {
        reasons.push(`prevPrimitive=Occupy,run=${trailingOccupyRun},demoted-to-Sequence`);
        primitive = "Sequence";
      } else {
        primitive = "Occupy";
      }
    } else if (ordered.length > 1) {
      // Gallery内は常に他の写真と隣接する(画像しか入らないため)。
      // Occupy不適格な写真は、他に並ぶ写真がある限りSequence(列の一部)として扱う。
      reasons.push("adjacentImage=true");
      primitive = "Sequence";
    } else {
      // 写真が1枚だけのGalleryでOccupy不適格な場合のみIsolate。
      primitive = "Isolate";
    }

    results.push({ artifact, primitive, reasons });
  }

  return results;
}
