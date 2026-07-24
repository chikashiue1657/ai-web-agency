import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * 写真1枚のときは全幅1枚、2枚のときは非対称の2分割、3枚以上のときは
 * 比率の異なるタイルを組み合わせたモザイクにする。3列×2段の均一グリッドには
 * 固定しない。件数はGoogle Places側の取得件数に依るため、3枚以上は
 * スロット定義を循環させてどの枚数でも破綻しないようにしている。
 */
const MOSAIC_SLOTS = [
  { className: "col-span-4 row-span-2", aspect: "aspect-[4/5]" },
  { className: "col-span-2 row-span-1", aspect: "aspect-[4/3]" },
  { className: "col-span-2 row-span-1", aspect: "aspect-[4/3]" },
  { className: "col-span-3 row-span-1", aspect: "aspect-[16/9]" },
  { className: "col-span-3 row-span-1", aspect: "aspect-[16/9]" },
];

export function PhotoStoryV2({ storeName, photoUrls, theme }: { storeName: string; photoUrls: string[]; theme: CafeThemeV2 }) {
  if (photoUrls.length === 0) return null;

  return (
    <section id="photo-story" className={theme.paperBg}>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-10 sm:py-20 lg:px-16">
        {photoUrls.length === 1 && (
          <RevealV2 variant="scale">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrls[0]}
              alt={`${storeName}の店内`}
              className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
            />
          </RevealV2>
        )}

        {photoUrls.length === 2 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:gap-4">
            <RevealV2 variant="scale" className="sm:col-span-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrls[0]} alt={`${storeName}の店内`} className="aspect-[4/5] w-full object-cover sm:h-full" />
            </RevealV2>
            <RevealV2 variant="scale" delayMs={120} className="sm:col-span-2 sm:self-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrls[1]} alt={`${storeName}の商品`} className="aspect-[4/3] w-full object-cover" />
            </RevealV2>
          </div>
        )}

        {photoUrls.length >= 3 && (
          <div className="grid grid-cols-6 gap-2 sm:gap-3">
            {photoUrls.map((url, i) => {
              const slot = MOSAIC_SLOTS[i % MOSAIC_SLOTS.length];
              return (
                <RevealV2 key={url} variant="scale" delayMs={(i % MOSAIC_SLOTS.length) * 80} className={slot.className}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`${storeName}の様子`} className={`h-full w-full object-cover ${slot.aspect}`} />
                </RevealV2>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
