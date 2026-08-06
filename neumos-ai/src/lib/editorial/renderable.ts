/**
 * 編集パイプラインのRenderableアダプタ層。Artifactと Presentationの間に置く。
 * neumos-ai/docs/design/editorial-pipeline-design.md 9章。
 *
 * 編集する最終単位はArtifactそのものではなく、Artifactを1件以上束ねたRenderable
 * にする。今回の実装では束ね処理(複数Artifactを1つのRenderableへ合成する
 * ロジック)自体は実装せず、恒等変換(1 Artifact = 1 Renderable)のみを行う。
 * `intent`は今回常に"none"だが、将来の束ね判断ロジックが実質的な値を
 * 設定できるよう型として先に用意しておく。
 */
import type { Artifact, ArtifactMedia } from "./artifact";

/**
 * 編集意図。Presentationが参照してよい唯一の「意味」に相当する情報。
 * 今回は束ね処理を実装しないため、全Renderableで"none"固定になる。
 */
export type RenderableIntent = "focus" | "support" | "sequence" | "pair" | "none";

export interface Renderable {
  id: string;
  /** 長さ1が今回の実装における唯一のケース。将来、複数Artifactを束ねる処理がここに入る。 */
  artifacts: Artifact[];
  /** artifacts全体の媒体。今回は常にartifacts[0].mediaと一致する。 */
  media: ArtifactMedia | "mixed";
  /** tie-break用。artifacts中のsourceOrderの最小値。 */
  sourceOrder: number;
  /** 今回は常に"none"。将来の束ね処理が設定する。 */
  intent: RenderableIntent;
}

/** 今回の実装: 恒等変換。intentは常に"none"を設定する。 */
export function toRenderables(ordered: readonly Artifact[]): Renderable[] {
  return ordered.map((artifact) => ({
    id: `renderable:${artifact.id}`,
    artifacts: [artifact],
    media: artifact.media,
    sourceOrder: artifact.sourceOrder,
    intent: "none",
  }));
}
