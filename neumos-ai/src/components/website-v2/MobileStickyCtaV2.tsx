import type { WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { CtaStyle, SurfaceClasses } from "@/lib/engine/v2-design-system";

/**
 * モバイル専用の下部固定CTAバー。PC(sm以上)では表示しない。
 * ページ本文の`<main>`側に、このバーの高さ分の下余白を別途確保する
 * （WebsiteRendererV2.tsx側で付与。本文の末尾がバーの下に隠れないため）。
 *
 * ノッチ付き端末で画面最下部の安全領域に食い込まないよう、
 * `env(safe-area-inset-bottom)`をpaddingへ加える。
 * アニメーションを伴わない常時表示の固定要素のため、prefers-reduced-motion
 * による特別な分岐は不要（何も動かさないため、そもそも配慮する対象が無い）。
 */
export function MobileStickyCtaV2({
  cta,
  theme,
  surface,
  ctaStyle = "outline-minimal",
}: {
  cta: WebsiteCta;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  ctaStyle?: CtaStyle;
}) {
  const buttonClass =
    ctaStyle === "solid-bold"
      ? `flex-1 rounded-full ${theme.ctaBg} px-5 py-3 text-center text-sm font-semibold text-white transition active:opacity-80`
      : ctaStyle === "text-link"
      ? `flex-1 rounded-full border border-current px-5 py-3 text-center text-sm font-medium transition active:opacity-70 ${theme.bodyText}`
      : `flex-1 rounded-full border-2 border-current px-5 py-3 text-center text-sm font-semibold transition active:opacity-70 ${theme.bodyText}`;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:hidden ${theme.paperRaisedBg} ${surface.divider}`}
    >
      <a href={cta.href} className={buttonClass}>
        {cta.buttonLabel}
      </a>
    </div>
  );
}
