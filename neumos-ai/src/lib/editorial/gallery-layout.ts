/**
 * Gallery(PhotoStoryV2)専用のレイアウト判定。
 *
 * 以前は`presentation.ts`という抽象名だったが、実質的にGallery専用の判定
 * ロジックであり、抽象名のままだと将来「ページ全体をPresentationしよう」という
 * 誘惑が戻ってくる(実際に一度、ページ全体Rendererとして誤用した経緯がある)。
 * 名前と責務をGallery限定であることに合わせて`assignGalleryLayout`とした。
 *
 * 判定に使うのは解像度・縦横比・隣接関係・連続数のみ。absorbedCount(撮影枚数)
 * は使わない(「撮影枚数の多さ」と「情報としての重要度」を混同しないため)。
 */
import { type ImageArtifact } from "./artifact";

export type GalleryLayoutKind = "Occupy" | "Sequence" | "Isolate";

export interface GalleryPhotoAssignment {
  artifact: ImageArtifact;
  layout: GalleryLayoutKind;
  /** テスト・デバッグ用: なぜこのLayoutKindになったかの根拠トレース。 */
  reasons: string[];
}

/** Occupy(大きな1枚)の技術的な適格条件: 解像度。低解像度の画像を無理に拡大しない。 */
const OCCUPY_MIN_WIDTH = 1200;
/** 同一LayoutKindがこの件数連続したら次を降格する。 */
const MAX_SAME_LAYOUT_RUN = 2;

function isExtremeAspectRatio(width?: number, height?: number): boolean {
  if (!width || !height) return true; // 不明な場合はOccupy不適格側に倒す(安全側)
  const ratio = width / height;
  return ratio > 3 || ratio < 1 / 3;
}

function countTrailingRun(results: readonly GalleryPhotoAssignment[], layout: GalleryLayoutKind): number {
  let run = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].layout === layout) run++;
    else break;
  }
  return run;
}

export function assignGalleryLayout(ordered: readonly ImageArtifact[]): GalleryPhotoAssignment[] {
  const results: GalleryPhotoAssignment[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const artifact = ordered[i];
    const reasons: string[] = [];
    const { width, height } = artifact;
    const extreme = isExtremeAspectRatio(width, height);
    const sizeOk = (width ?? 0) >= OCCUPY_MIN_WIDTH;
    reasons.push(`width=${width ?? "unknown"}`, `aspectExtreme=${extreme}`);

    let layout: GalleryLayoutKind;
    if (sizeOk && !extreme) {
      const trailingOccupyRun = countTrailingRun(results, "Occupy");
      if (trailingOccupyRun >= MAX_SAME_LAYOUT_RUN) {
        reasons.push(`prevLayout=Occupy,run=${trailingOccupyRun},demoted-to-Sequence`);
        layout = "Sequence";
      } else {
        layout = "Occupy";
      }
    } else if (ordered.length > 1) {
      // Gallery内は常に他の写真と隣接する(画像しか入らないため)。
      // Occupy不適格な写真は、他に並ぶ写真がある限りSequence(列の一部)として扱う。
      reasons.push("adjacentImage=true");
      layout = "Sequence";
    } else {
      // 写真が1枚だけのGalleryでOccupy不適格な場合のみIsolate。
      layout = "Isolate";
    }

    results.push({ artifact, layout, reasons });
  }

  return results;
}
