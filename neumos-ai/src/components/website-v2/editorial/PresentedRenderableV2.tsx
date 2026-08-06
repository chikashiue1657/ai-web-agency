import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { PresentedRenderable } from "@/lib/editorial/presentation";
import { isImageArtifact, isTextArtifact } from "@/lib/editorial/artifact";
import { SafeImageV2 } from "../SafeImageV2";

/**
 * Editorial Layerの1件(PresentedRenderable)を実際のDOMへ変換する。
 * neumos-ai/docs/design/editorial-pipeline-design.md 11章。
 *
 * Primitiveごとに固定のTailwindクラス(既存theme-v2.tsのトークンを使用)を
 * 返す薄い分岐コンポーネント。Motionの決定ロジックはPhase 7でこのファイルの
 * 内部に追加する(Presentation層は`primitive`という値だけを返し、Motionを
 * 一切知らない。11章の依存方向の原則)。
 */
export function PresentedRenderableV2({ presented, theme }: { presented: PresentedRenderable; theme: CafeThemeV2 }) {
  const artifact = presented.renderable.artifacts[0];

  if (isImageArtifact(artifact)) {
    const aspectClass =
      presented.primitive === "Occupy"
        ? "aspect-[4/3] sm:aspect-[21/9]"
        : presented.primitive === "Sequence"
          ? "aspect-[4/3]"
          : "mx-auto aspect-square max-w-sm";
    return (
      <section className="w-full" data-primitive={presented.primitive}>
        <SafeImageV2
          src={artifact.url}
          alt={`${presented.renderable.id}の写真`}
          className={`w-full ${aspectClass} object-cover`}
          collapseOnFail
        />
      </section>
    );
  }

  if (isTextArtifact(artifact)) {
    const isOccupy = presented.primitive === "Occupy";
    return (
      <section className={theme.paperBg} data-primitive={presented.primitive}>
        <div className={`mx-auto max-w-3xl px-5 sm:px-10 ${isOccupy ? "py-20 sm:py-28" : "py-6 sm:py-8"}`}>
          <p
            className={`${theme.displayFont} ${theme.bodyText} ${
              isOccupy
                ? "text-2xl leading-relaxed sm:text-4xl sm:leading-[1.5]"
                : "text-sm leading-relaxed sm:text-base"
            }`}
          >
            {artifact.text}
          </p>
        </div>
      </section>
    );
  }

  return null;
}
