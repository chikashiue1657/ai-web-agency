import type { StoreReview } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * 信頼材料を見せるセクション。
 *
 * 表示するのは実データがある項目だけで、固定値・ダミー値は一切使わない。
 *  - Google評価(rating/reviewCount)のどちらかがあれば、その数字を見せる。
 *  - レビュー本文(reviews)があれば証言として添える。
 *  - Google評価が無くInstagramのURLだけがある場合は、代わりにSNSへの
 *    導線を信頼要素として見せる（フォロワー数などの数字は取得できないため
 *    表示しない。あくまで「実際に運用しているSNSがある」という事実だけを示す）。
 *  - どちらも無ければセクション自体を描画しない（section-plan-v2側でも
 *    ガードしているが、このコンポーネント単体でも安全側に倒す）。
 */
export function TrustV2({
  googleRating,
  googleReviewCount,
  reviews,
  instagramUrl,
  theme,
}: {
  googleRating?: number;
  googleReviewCount?: number;
  reviews?: StoreReview[];
  instagramUrl?: string;
  theme: CafeThemeV2;
}) {
  const hasRating = typeof googleRating === "number" || !!googleReviewCount;
  const hasInstagram = !!instagramUrl;
  if (!hasRating && !hasInstagram) return null;
  const hasReviews = (reviews?.length ?? 0) > 0;

  return (
    <section id="trust" className={`${theme.darkSectionBg}`}>
      <div
        className={`mx-auto grid max-w-5xl grid-cols-1 gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:px-16 ${
          hasReviews ? "sm:grid-cols-[auto_1fr]" : ""
        }`}
      >
        <RevealV2>
          <div>
            {hasRating ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Google Reviews</p>
                {typeof googleRating === "number" && (
                  <span className={`mt-3 block text-6xl sm:text-7xl ${theme.displayFont} ${theme.darkSectionText}`}>
                    ★{googleRating.toFixed(1)}
                  </span>
                )}
                {googleReviewCount ? (
                  <p className="mt-2 text-sm text-white/70 sm:text-base">{googleReviewCount}件のレビューより</p>
                ) : null}
                {hasInstagram && (
                  <a
                    href={instagramUrl}
                    className="mt-6 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-xs text-white/80 hover:border-white"
                  >
                    Instagramで見る
                    <span aria-hidden>→</span>
                  </a>
                )}
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Follow</p>
                <p className={`mt-3 max-w-[24ch] text-2xl leading-snug sm:text-3xl ${theme.displayFont} ${theme.darkSectionText}`}>
                  日々の様子はInstagramで
                </p>
                <a
                  href={instagramUrl}
                  className="mt-6 inline-flex items-center gap-2 border-b border-white/40 pb-1 text-sm text-white/85 hover:border-white"
                >
                  Instagramを見る
                  <span aria-hidden>→</span>
                </a>
              </>
            )}
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
