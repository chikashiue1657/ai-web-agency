"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * IntersectionObserverによる軽量reveal。ライブラリを使わず、CSS transitionだけで
 * 「表示領域に入ったらふわっと出る」を実現する。
 *
 * 既定（SSR直後・JS未実行・hydration前）は必ず「表示済み」の状態でHTMLを返す。
 * 以前は既定を非表示（opacity-0）にしてJSの発火を待つ実装にしていたが、
 * JSが動かない環境（実行前の一瞬・読み込み失敗・スクロールを伴わずにDOMを
 * 取得するツール等）では要素が永久に不可視のままになる実バグがあった
 * （星評価やメニュー項目が消えたままになることを比較検証で発見した）。
 * マウント後に「実際に画面外にある」ことを確認できた要素だけ、控えめな
 * reveal演出の対象にする（＝演出は常に完成済みの静的表示の上に乗る追加効果とし、
 * 演出無しでは情報が欠けるような依存関係を作らない）。
 *
 * variant="scale"（写真専用）以外はopacityを一切下げない。文章・数値を
 * opacity-0で隠すと、reveal発火前の一瞬（スクロールを伴わない解析ツールや、
 * 読み込み直後にreveal前の状態を見る利用者）でテキストの実効コントラストが
 * 大きく下がり、axe-coreのcolor-contrast検証で実際に検出される不具合になった。
 * テキスト系（fade-up/fade）は位置（translate）だけを動かし、常に不透明度100%を保つ。
 */
export function RevealV2({
  children,
  className = "",
  variant = "fade-up",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  variant?: "fade-up" | "fade" | "scale";
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = el.getBoundingClientRect();
    const alreadyInViewport = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyInViewport) return;

    setVisible(false);
    setArmed(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // scale（写真専用）だけがopacityクラスを持つ。fade-up/fadeはopacityクラスを
  // 一切出力しない（=常にブラウザ既定の不透明のまま）ことで、Tailwindの
  // opacity-0とopacity-100が同じ要素に両方乗って詳細度の生成順で片方が
  // 無効化される事故を避ける。
  const stateClass =
    variant === "scale"
      ? visible
        ? "opacity-100 scale-100"
        : "opacity-0 scale-[1.04]"
      : visible
        ? "translate-y-0"
        : variant === "fade-up"
          ? "translate-y-6"
          : "translate-y-2";

  return (
    <div
      ref={ref}
      style={armed && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:!transition-none motion-reduce:!transform-none motion-reduce:!opacity-100 ${stateClass} ${className}`}
    >
      {children}
    </div>
  );
}
