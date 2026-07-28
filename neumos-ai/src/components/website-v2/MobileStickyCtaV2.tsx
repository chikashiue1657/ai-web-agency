"use client";
import { useEffect, useState } from "react";
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
 *
 * 最終CTAセクション（`#contact`）が画面内に入ったら、このバーを隠す。
 * 最終CTAには既にこのバーと同じ操作（お問い合わせ）を行う大きなボタンが
 * あるため、両方を同時に見せると重複感が生まれる（実際に指摘された問題）。
 * IntersectionObserverでの検知のため、非表示への切り替えはアニメーションを
 * 伴うが、位置そのものは動かさず不透明度と`pointer-events`だけを切り替える
 * ため`prefers-reduced-motion`でも問題にならない（動きの量ではなく状態の
 * 変化）。念のためtransition-durationだけ短縮する。
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
  const [nearFinalCta, setNearFinalCta] = useState(false);

  useEffect(() => {
    const target = document.getElementById("contact");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setNearFinalCta(entry.isIntersecting), {
      rootMargin: "0px 0px -10% 0px",
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const buttonClass =
    ctaStyle === "solid-bold"
      ? `flex-1 rounded-full ${theme.ctaBg} px-5 py-3 text-center text-sm font-semibold text-white transition active:opacity-80`
      : ctaStyle === "text-link"
      ? `flex-1 rounded-full border border-current px-5 py-3 text-center text-sm font-medium transition active:opacity-70 ${theme.bodyText}`
      : `flex-1 rounded-full border-2 border-current px-5 py-3 text-center text-sm font-semibold transition active:opacity-70 ${theme.bodyText}`;

  return (
    <div
      aria-hidden={nearFinalCta}
      className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-opacity duration-200 motion-reduce:duration-0 sm:hidden ${theme.paperRaisedBg} ${surface.divider} ${
        nearFinalCta ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <a href={cta.href} tabIndex={nearFinalCta ? -1 : 0} className={buttonClass}>
        {cta.buttonLabel}
      </a>
    </div>
  );
}
