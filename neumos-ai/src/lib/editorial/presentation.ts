/**
 * 編集パイプラインのPresentation段。RenderableへPresentation Primitiveを割り当てる。
 * neumos-ai/docs/design/editorial-pipeline-design.md 10章。
 *
 * Primitive名は配置意図を表す抽象語彙にしてある(UI部品名ではない)。
 *  - Occupy  : 主要な表示領域を占有する(画像のviewport・テキストのfull-widthを統合)
 *  - Sequence: 同種の並びの一部として連続的に現れる
 *  - Isolate : 単独で、控えめな規模で現れる
 *  - Support : 補助的・注釈的な役割
 *  - Pair    : 2つのArtifactを束ねたRenderableに対してのみ発生する(今回未使用)
 *
 * 割り当ては単一条件の決め打ちを避け、複数の構造シグナル(媒体種別・文字量・
 * 縦横比・Arrange後の隣接関係・前後のPrimitive・同一Primitiveの連続数)を
 * 組み合わせる。`absorbedCount`(Compressが記録したデバッグ専用フィールド)は
 * 判定に一切使わない(「撮影枚数の多さ」と「情報としての重要度」を混同しない
 * ため。artifact.tsのコメント参照)。
 */
import { isImageArtifact, isTextArtifact } from "./artifact";
import type { Renderable } from "./renderable";

export type PresentationPrimitive = "Occupy" | "Sequence" | "Isolate" | "Support" | "Pair";

export interface PresentedRenderable {
  renderable: Renderable;
  primitive: PresentationPrimitive;
  /** テスト・デバッグ用: なぜこのPrimitiveになったかの根拠トレース。 */
  reasons: string[];
}

/** Occupy(画像)の技術的な適格条件: 解像度。低解像度の画像を無理に拡大しない。 */
const OCCUPY_MIN_WIDTH = 1200;
/** Occupy(テキスト)の適格条件: 文字量。 */
const TEXT_OCCUPY_MIN_CHARS = 120;
/** 同一Primitiveがこの件数連続したら次を降格する。 */
const MAX_SAME_PRIMITIVE_RUN = 2;

function isExtremeAspectRatio(width?: number, height?: number): boolean {
  if (!width || !height) return true; // 不明な場合はOccupy不適格側に倒す(安全側)
  const ratio = width / height;
  return ratio > 3 || ratio < 1 / 3;
}

function countTrailingRun(results: readonly PresentedRenderable[], primitive: PresentationPrimitive): number {
  let run = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i].primitive === primitive) run++;
    else break;
  }
  return run;
}

function assignImagePrimitive(
  renderable: Renderable,
  index: number,
  ordered: readonly Renderable[],
  results: readonly PresentedRenderable[]
): { primitive: PresentationPrimitive; reasons: string[] } {
  const primary = renderable.artifacts[0];
  const reasons: string[] = [];
  if (!isImageArtifact(primary)) return { primitive: "Isolate", reasons: ["invalid-image-artifact"] };

  const { width, height } = primary;
  const extreme = isExtremeAspectRatio(width, height);
  const sizeOk = (width ?? 0) >= OCCUPY_MIN_WIDTH;
  reasons.push(`width=${width ?? "unknown"}`, `aspectExtreme=${extreme}`);

  if (sizeOk && !extreme) {
    const trailingOccupyRun = countTrailingRun(results, "Occupy");
    if (trailingOccupyRun >= MAX_SAME_PRIMITIVE_RUN) {
      reasons.push(`prevPrimitive=Occupy,run=${trailingOccupyRun},demoted-to-Sequence`);
      return { primitive: "Sequence", reasons };
    }
    return { primitive: "Occupy", reasons };
  }

  const prevIsImage = index > 0 && ordered[index - 1].media === "image";
  const nextIsImage = index < ordered.length - 1 && ordered[index + 1].media === "image";
  if (prevIsImage || nextIsImage) {
    reasons.push("adjacentImage=true");
    return { primitive: "Sequence", reasons };
  }
  return { primitive: "Isolate", reasons };
}

function assignTextPrimitive(
  renderable: Renderable,
  results: readonly PresentedRenderable[]
): { primitive: PresentationPrimitive; reasons: string[] } {
  const primary = renderable.artifacts[0];
  const reasons: string[] = [];
  if (!isTextArtifact(primary)) return { primitive: "Support", reasons: ["invalid-text-artifact"] };

  const { charCount } = primary;
  reasons.push(`charCount=${charCount}`);

  if (charCount >= TEXT_OCCUPY_MIN_CHARS) {
    const prev = results[results.length - 1];
    if (prev?.primitive === "Occupy") {
      reasons.push("prevPrimitive=Occupy,demoted-to-Support");
      return { primitive: "Support", reasons };
    }
    return { primitive: "Occupy", reasons };
  }
  return { primitive: "Support", reasons };
}

export function assignPresentation(ordered: readonly Renderable[]): PresentedRenderable[] {
  const results: PresentedRenderable[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const renderable = ordered[i];
    let outcome: { primitive: PresentationPrimitive; reasons: string[] };

    if (renderable.media === "image") {
      outcome = assignImagePrimitive(renderable, i, ordered, results);
    } else if (renderable.media === "text") {
      outcome = assignTextPrimitive(renderable, results);
    } else {
      // "mixed"(複数Artifactを束ねたRenderable)は今回未使用の拡張点。
      outcome = { primitive: "Pair", reasons: ["media=mixed(reserved-for-future-bundling)"] };
    }

    results.push({ renderable, primitive: outcome.primitive, reasons: outcome.reasons });
  }

  return results;
}
