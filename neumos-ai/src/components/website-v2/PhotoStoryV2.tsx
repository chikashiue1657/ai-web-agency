import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * Gallery（写真セクション）。写真サイズを固定しない。1枚のときだけ
 * 意図的に横長バナー（あえて選んだ比率で、複数枚の均一な矩形化とは別物）
 * として見せ、2枚以上はすべて同じ仕組み（列に自然な高さで流し込む
 * Pinterest風Masonry）で扱う。画像自身のaspect-ratioを固定しないため、
 * 縦長・横長・正方形が混在してもレイアウトが破綻しない。列数だけを
 * 枚数に応じて増減させ、"3〜4枚だけ特別な矩形グリッド"のような
 * 枚数ごとの専用レイアウトは持たない（=固定パターンの反復を避ける）。
 */
function columnsForCount(count: number): string {
  if (count === 2) return "columns-1 sm:columns-2";
  if (count <= 4) return "columns-2 sm:columns-2 lg:columns-3";
  return "columns-2 sm:columns-3 lg:columns-4";
}

export function PhotoStoryV2({
  storeName,
  photoUrls,
  theme,
}: {
  storeName: string;
  photoUrls: string[];
  theme: CafeThemeV2;
}) {
  if (photoUrls.length === 0) return null;
  const count = photoUrls.length;

  return (
    <section id="photo-story" className={`${theme.paperBg} py-10 sm:py-14`}>
      {count === 1 && (
        <RevealV2 variant="scale">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrls[0]}
            alt={`${storeName}の店内`}
            className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
          />
        </RevealV2>
      )}

      {count >= 2 && (
        <div className={`${columnsForCount(count)} gap-1 px-1 sm:gap-2 sm:px-2`}>
          {photoUrls.map((url, i) => (
            <RevealV2 key={url} variant="scale" delayMs={(i % 6) * 70} className="mb-1 break-inside-avoid sm:mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${storeName}の様子`} className="block w-full" />
            </RevealV2>
          ))}
        </div>
      )}
    </section>
  );
}
