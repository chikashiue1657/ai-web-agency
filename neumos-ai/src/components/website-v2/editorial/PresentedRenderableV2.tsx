import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { PresentationPrimitive, PresentedRenderable } from "@/lib/editorial/presentation";
import { isImageArtifact, isTextArtifact } from "@/lib/editorial/artifact";
import { SafeImageV2 } from "../SafeImageV2";
import { RevealV2 } from "../RevealV2";

/**
 * Editorial Layerの1件(PresentedRenderable)を実際のDOMへ変換する。
 * neumos-ai/docs/design/editorial-pipeline-design.md 11章。
 *
 * Primitiveごとに固定のTailwindクラス(既存theme-v2.tsのトークンを使用)を
 * 返す薄い分岐コンポーネント。
 *
 * Motion(Phase 7): `assignPresentation`(presentation.ts)は`primitive`という
 * 値だけを返し、Motionを一切知らない。Primitive→RevealVariant/delayMsの
 * 対応表はこのRender層のファイル内だけに閉じており、Renderの実装
 * (レイアウト・DOM構造)が将来変わってもPresentation層のコード・型には
 * 一切影響しない、という依存方向(Render→Presentationの出力を参照する。
 * 逆ではない)を保つ。既存の`RevealV2`をそのまま再利用し、新しいモーション
 * エンジンは作らない(Stage6/7で実測検証済みの録画品質を壊さないため)。
 */
const MOTION_BY_PRIMITIVE: Record<PresentationPrimitive, { variant: "fade-up" | "fade" | "scale"; delayMs: number }> = {
  Occupy: { variant: "scale", delayMs: 0 },
  Sequence: { variant: "fade-up", delayMs: 80 },
  Isolate: { variant: "fade", delayMs: 0 },
  Support: { variant: "fade", delayMs: 40 },
  Pair: { variant: "fade-up", delayMs: 0 },
};

export function PresentedRenderableV2({ presented, theme }: { presented: PresentedRenderable; theme: CafeThemeV2 }) {
  const artifact = presented.renderable.artifacts[0];
  const motion = MOTION_BY_PRIMITIVE[presented.primitive];

  if (isImageArtifact(artifact)) {
    const aspectClass =
      presented.primitive === "Occupy"
        ? "aspect-[4/3] sm:aspect-[21/9]"
        : presented.primitive === "Sequence"
          ? "aspect-[4/3]"
          : "mx-auto aspect-square max-w-sm";
    return (
      <section className="w-full" data-primitive={presented.primitive}>
        <RevealV2 variant={motion.variant} delayMs={motion.delayMs}>
          <SafeImageV2
            src={artifact.url}
            alt={`${presented.renderable.id}の写真`}
            className={`w-full ${aspectClass} object-cover`}
            collapseOnFail
          />
        </RevealV2>
      </section>
    );
  }

  if (isTextArtifact(artifact)) {
    const isOccupy = presented.primitive === "Occupy";
    return (
      <section className={theme.paperBg} data-primitive={presented.primitive}>
        <div className={`mx-auto max-w-3xl px-5 sm:px-10 ${isOccupy ? "py-20 sm:py-28" : "py-6 sm:py-8"}`}>
          <RevealV2 variant={motion.variant} delayMs={motion.delayMs}>
            <p
              className={`${theme.displayFont} ${theme.bodyText} ${
                isOccupy
                  ? "text-2xl leading-relaxed sm:text-4xl sm:leading-[1.5]"
                  : "text-sm leading-relaxed sm:text-base"
              }`}
            >
              {artifact.text}
            </p>
          </RevealV2>
        </div>
      </section>
    );
  }

  return null;
}
