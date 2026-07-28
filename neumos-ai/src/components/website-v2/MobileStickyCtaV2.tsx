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
 * 最終CTAセクション（`#contact`）に到達したら、このバーを隠す。
 * 最終CTAには既にこのバーと同じ操作（お問い合わせ）を行う大きなボタンが
 * あるため、両方を同時に見せると重複感が生まれる（実際に指摘された問題）。
 *
 * IntersectionObserverで`#contact`の可視状態だけを見ると、`#contact`を
 * 通り過ぎてFooterへ入った瞬間に`isIntersecting`がfalseへ戻り、バーが
 * 再表示されてFooter本文に重なる不具合があった（実際に発生を確認した）。
 * `#contact`の上端がビューポート内に入って以降はページ末尾まで隠れたままに
 * したいため、intersection(在/不在)ではなく`#contact`の上端の画面上の位置を
 * 見て判定する（一度隠れたら、上にスクロールして`#contact`より前へ戻るまで
 * 再表示しない）。
 * 非表示への切り替えはアニメーションを伴うが、位置そのものは動かさず
 * 不透明度と`pointer-events`だけを切り替えるため`prefers-reduced-motion`でも
 * 問題にならない（動きの量ではなく状態の変化）。念のためtransition-durationだけ短縮する。
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
    let ticking = false;
    const check = () => {
      ticking = false;
      setNearFinalCta(target.getBoundingClientRect().top <= window.innerHeight);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
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
