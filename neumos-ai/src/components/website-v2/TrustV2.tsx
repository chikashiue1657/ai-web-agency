import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * Googleの評価を信頼材料として大きく見せるセクション。
 * ratingかreviewCountのどちらかが実際に取得できている場合のみ描画される
 * （section-plan-v2側でガード済み）。カード枠は使わず、色面いっぱいに
 * 数字そのものを主役にする。
 */
export function TrustV2({
  googleRating,
  googleReviewCount,
  theme,
}: {
  googleRating?: number;
  googleReviewCount?: number;
  theme: CafeThemeV2;
}) {
  if (typeof googleRating !== "number" && !googleReviewCount) return null;

  return (
    <section id="trust" className={`${theme.heroNoPhotoBg}`}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-5 py-16 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Google Reviews</p>
        <RevealV2 variant="fade">
          <div className="flex items-baseline gap-3">
            {typeof googleRating === "number" && (
              <span className={`text-6xl sm:text-8xl ${theme.displayFont} ${theme.heroNoPhotoText}`}>
                ★{googleRating.toFixed(1)}
              </span>
            )}
          </div>
        </RevealV2>
        {googleReviewCount ? (
          <p className="text-sm text-white/70 sm:text-base">{googleReviewCount}件のレビューより</p>
        ) : null}
      </div>
    </section>
  );
}
