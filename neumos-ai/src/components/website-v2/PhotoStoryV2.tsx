import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * 写真セクション。ギャラリーの均一グリッドにはしない。件数（Hero用の1枚を
 * 除いた残り）に応じてレイアウト自体を変える。
 *   1枚: 画面幅いっぱいの1枚
 *   2枚: 正確に50:50の左右分割
 *   3〜4枚: 大小非対称のグリッド
 *   5枚以上: 列に自然な高さで流し込むPinterest風Masonry（画像の実寸比率をそのまま使う）
 * セクション自体もmax-w-6xl等のコンテナ幅に収めず、画面幅いっぱいに写真を
 * 使う（ブランドサイトとして写真を主役にするため）。
 */
const ASYMMETRIC_SLOTS = [
  { className: "col-span-2 row-span-2", aspect: "aspect-square" },
  { className: "col-span-1 row-span-1", aspect: "aspect-[3/4]" },
  { className: "col-span-1 row-span-1", aspect: "aspect-[3/4]" },
  { className: "col-span-3 row-span-1", aspect: "aspect-[21/9]" },
];

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

      {count === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {photoUrls.map((url, i) => (
            <RevealV2 key={url} variant="scale" delayMs={i * 120}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={i === 0 ? `${storeName}の店内` : `${storeName}の商品`}
                className="aspect-square w-full object-cover sm:aspect-auto sm:h-[64vh]"
              />
            </RevealV2>
          ))}
        </div>
      )}

      {count >= 3 && count <= 4 && (
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-1 px-1 sm:gap-2 sm:px-2">
          {photoUrls.map((url, i) => {
            const slot = ASYMMETRIC_SLOTS[i];
            return (
              <RevealV2 key={url} variant="scale" delayMs={i * 100} className={slot.className}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${storeName}の様子`} className={`h-full w-full object-cover ${slot.aspect}`} />
              </RevealV2>
            );
          })}
        </div>
      )}

      {count >= 5 && (
        <div className="columns-2 gap-1 px-1 sm:columns-3 sm:gap-2 sm:px-2">
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
