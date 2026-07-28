"use client";
import { useEffect, useRef, useState } from "react";

/**
 * 読み込みに失敗した写真を、壊れた画像アイコンのまま見せない共通コンポーネント。
 *
 * `collapseOnFail`（既定false）: trueの場合、失敗時に何も描画しない
 * （`null`）。CSS Grid/Flexbox/columnsのようなauto-placementレイアウトの
 * 1枠として使う場合、失敗した枠をDOMから消せば残りの写真が自然に
 * 詰め直される（再配置のためにJSでレイアウト計算をし直す必要が無い）。
 * falseの場合は罫線1本の最小限の面へ差し替える（テクスチャ無し。
 * 「画像プレースホルダーです」と分かる特別な演出はしない。no-photo構成と
 * 混同されないよう最小限に留める）。
 *
 * `onFail`（任意）: 呼び出し側が失敗枚数を数えて「全滅したらセクションごと
 * 隠す」等の判断をする場合に使う。
 *
 * object-positionはVisionによる被写体位置の実データが無いため、常に中央
 * （object-center）を基本にする。URLや配列内の並び順から被写体位置を
 * 推測する処理は行わない（捏造禁止の方針を写真の切り取り位置にも適用する）。
 *
 * SSRしたHTMLは`<img src="...">`が最初からマークアップに含まれるため、
 * ブラウザはReactのhydration完了より前にリクエストを開始する。読み込みに
 * 失敗するタイミングがhydration前だと、Reactがまだ`onError`をアタッチして
 * おらずイベントを取りこぼす（実際にこの取りこぼしで壊れた画像アイコンが
 * 表示され続ける不具合を確認した）。そのためmount時に`img.complete &&
 * naturalWidth===0`を明示的にチェックし、hydration前に失敗していた場合も
 * 検出する。
 */
export function SafeImageV2({
  src,
  alt,
  className = "",
  collapseOnFail = false,
  onFail,
}: {
  src: string;
  alt: string;
  className?: string;
  collapseOnFail?: boolean;
  onFail?: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) {
      setFailed(true);
      onFail?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) {
    if (collapseOnFail) return null;
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center border border-stone-200 bg-stone-100 ${className}`}
      >
        <span className="h-px w-8 bg-stone-300" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
      className={`object-center ${className}`}
    />
  );
}
