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
 * テキスト系（fade-up/fade）は位置（translate）だけを動かし、常に不透明度100%を保つ。
 *
 * variant="scale"はscale-[1.04]で「わずかに拡大した状態」から等倍へ収束させる。
 * このscaleと同じ要素にoverflow-hiddenを付けても、クリップ境界自体が一緒に
 * 拡大されてしまうため画像のはみ出しは防げない（実際にGallery内の単独バナー
 * 写真で横スクロールが発生するバグとして確認した）。そのため外側に
 * overflow-hiddenだけを持つ非変形の枠を1枚はさみ、scale/opacityの
 * トランジションは内側の要素にだけ適用する。
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

  const delayStyle = armed && delayMs ? { transitionDelay: `${delayMs}ms` } : undefined;

  if (variant === "scale") {
    return (
      <div className={`overflow-hidden ${className}`}>
        <div
          ref={ref}
          style={delayStyle}
          className={`transition-all duration-700 ease-out motion-reduce:!transition-none motion-reduce:!transform-none motion-reduce:!opacity-100 ${
            visible ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    );
  }

  const hiddenTranslate = variant === "fade-up" ? "translate-y-6" : "translate-y-2";

  return (
    <div
      ref={ref}
      style={delayStyle}
      className={`transition-all duration-700 ease-out motion-reduce:!transition-none motion-reduce:!transform-none ${
        visible ? "translate-y-0" : hiddenTranslate
      } ${className}`}
    >
      {children}
    </div>
  );
}
