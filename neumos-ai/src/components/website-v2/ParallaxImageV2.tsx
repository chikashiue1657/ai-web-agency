"use client";
import { useEffect, useRef } from "react";

/**
 * Hero背景写真への微細なパララックス。スクロール量に応じてtranslateYだけを
 * 動かす（回転・拡大縮小のアニメーションは使わない。静的な1.08倍scaleは
 * 端に隙間ができないための下地であって演出ではない）。
 * rAFでスロットルし、prefers-reduced-motionでは一切動かさない。
 */
export function ParallaxImageV2({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect) return;
      // スクロール量の12%だけ動かす微細なパララックス。上下±40pxに制限する。
      const offset = Math.max(-40, Math.min(40, rect.top * 0.12));
      el.style.transform = `translate3d(0, ${offset}px, 0) scale(1.08)`;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      // 中央構図ではなく三分割構図（右1/3寄り・やや上）を優先する。
      // 主題がどこにあっても機械的には分からないため、常に同じ黄金分割点に
      // 寄せることで「中央にドン」という素人写真的な構図を避ける。
      className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-[68%_38%] will-change-transform"
    />
  );
}
