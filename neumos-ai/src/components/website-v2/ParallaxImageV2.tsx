"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Hero背景写真への微細なパララックス。スクロール量に応じてtranslateYだけを
 * 動かす（回転・拡大縮小のアニメーションは使わない。静的な1.08倍scaleは
 * 端に隙間ができないための下地であって演出ではない）。
 * rAFでスロットルし、prefers-reduced-motionでは一切動かさない。
 *
 * object-positionは常に中央（object-center）を基本にする。以前は「右1/3寄り・
 * やや上」を全写真に一律適用していたが、これは実際の被写体位置を見ずに
 * 決め打ちした値であり、Vision等による焦点情報が無い以上は推測に過ぎない
 * （捏造禁止の方針を写真の切り取り位置にも適用し、中央固定へ変更した）。
 *
 * 画像の読み込みに失敗した場合は壊れた画像アイコンのまま見せず、罫線1本の
 * 最小限の面へ差し替える。SSRしたHTMLは`<img src="...">`が最初から
 * マークアップに含まれるため、ブラウザはReactのhydration完了より前に
 * リクエストを開始する。読み込み失敗がhydration前だと`onError`が
 * アタッチされておらずイベントを取りこぼす（実際にこの取りこぼしで壊れた
 * 画像アイコンが表示され続ける不具合を確認した）ため、mount時にも
 * `img.complete && naturalWidth===0`を明示的にチェックする。
 */
export function ParallaxImageV2({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

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

  if (failed) {
    return (
      <div role="img" aria-label={alt} className="absolute inset-0 flex items-center justify-center bg-stone-100">
        <span className="h-px w-10 bg-stone-300" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-center will-change-transform"
    />
  );
}
