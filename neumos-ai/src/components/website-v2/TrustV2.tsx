import type { StoreReview } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * Googleの評価を信頼材料として見せるセクション。
 * ratingかreviewCountのどちらかが実際に取得できている場合のみ描画される
 * （section-plan-v2側でガード済み）。左に大きな数字、右にレビュー本文
 * （取得できた場合のみ）という非対称の2カラムで、レビューは証言らしく
 * 引用符付きの大きめの文字とsurfaceStyleに応じた区切りで見せる。
 *
 * reviewsは現時点でMVP側にGoogle Places APIからレビュー本文を取得する処理が
 * 無いため、実データが来たときにだけ表示される（無ければ従来通り数字のみ）。
 */
export function TrustV2({
  googleRating,
  googleReviewCount,
  reviews,
  theme,
}: {
  googleRating?: number;
  googleReviewCount?: number;
  reviews?: StoreReview[];
  theme: CafeThemeV2;
}) {
  if (typeof googleRating !== "number" && !googleReviewCount) return null;
  const hasReviews = (reviews?.length ?? 0) > 0;

  return (
    <section id="trust" className={`${theme.heroNoPhotoBg}`}>
      <div
        className={`mx-auto grid max-w-5xl grid-cols-1 gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:px-16 ${
          hasReviews ? "sm:grid-cols-[auto_1fr]" : ""
        }`}
      >
        <RevealV2>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Google Reviews</p>
            {typeof googleRating === "number" && (
              <span className={`mt-3 block text-6xl sm:text-7xl ${theme.displayFont} ${theme.heroNoPhotoText}`}>
                ★{googleRating.toFixed(1)}
              </span>
            )}
            {googleReviewCount ? (
              <p className="mt-2 text-sm text-white/70 sm:text-base">{googleReviewCount}件のレビューより</p>
            ) : null}
          </div>
        </RevealV2>

        {hasReviews && (
          <ul className="flex flex-col gap-8 sm:gap-10">
            {reviews!.slice(0, 3).map((review, i) => (
              <li key={i} className="border-l border-white/20 pl-5 sm:pl-6">
                <RevealV2 variant="fade-up" delayMs={i * 100}>
                  <p
                    className={`max-w-[46ch] break-words text-lg leading-relaxed text-white/90 sm:text-xl ${theme.displayFont}`}
                  >
                    “{review.text}”
                  </p>
                  {review.authorName && (
                    <p className="mt-3 text-xs font-medium uppercase tracking-[0.15em] text-white/50">
                      {review.authorName}
                    </p>
                  )}
                </RevealV2>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
