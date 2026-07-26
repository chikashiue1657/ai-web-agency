import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { SurfaceClasses } from "@/lib/engine/v2-design-system";
import { RevealV2 } from "./RevealV2";

/**
 * メニュー・楽しみ方。単純な同幅カードの反復や「全項目が同じ見え方の一覧」を
 * やめ、先頭の1件だけを「本日のおすすめ」的な大きな見出しで見せ、残りを
 * レストランのメニュー表に近い2カラム（左に品名／右に説明）の一覧にする。
 * 品目ごとの実写真はGoogle Placesから個別に取得できないため、写真を捏造せず
 * 文字の強弱だけで組む。surfaceStyleに応じてfeatured枠の質感を変える。
 */
export function MenuV2({
  sections,
  offer,
  theme,
  surface,
  sectionHeadingClass,
}: {
  sections: WebsiteSection[];
  offer: string;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  sectionHeadingClass: string;
}) {
  if (sections.length === 0) return null;
  const [featured, ...rest] = sections;

  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-10 sm:py-24 lg:px-16">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Menu</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>メニュー・楽しみ方</h2>
        {offer && (
          <p className={`mt-3 max-w-[42ch] break-keep break-words text-sm sm:text-base ${theme.bodyTextSoft}`}>
            {offer}
          </p>
        )}

        {/* 先頭の1件だけ「本日のおすすめ」として大きく見せる。 */}
        <RevealV2
          variant="fade-up"
          className={`mt-10 ${surface.cardBg} ${surface.cardBorder} px-6 py-8 sm:mt-12 sm:px-10 sm:py-10`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.accentTextSoft}`}>Featured</p>
          <h3 className={`mt-3 text-2xl sm:text-3xl ${theme.displayFont} ${theme.bodyText}`}>{featured.heading}</h3>
          <p className={`mt-3 whitespace-pre-line text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
            {featured.body}
          </p>
        </RevealV2>

        {/*
          RevealV2は<div>を描画するため、<li>の外側に被せると<ul>の直接の子が
          <div>になり、支援技術向けのリスト構造が壊れる（axe-coreのlist/listitem
          違反として実際に検出された）。<li>自体はプレーンな直接の子のままにし、
          reveal演出は<li>の中身だけに適用する。
        */}
        {rest.length > 0 && (
          <ul className={`mt-4 border-t ${surface.divider}`}>
            {rest.map((s, i) => (
              <li key={s.id} className={`border-b py-7 last:border-b-0 ${surface.divider}`}>
                <RevealV2
                  variant="fade-up"
                  delayMs={i * 60}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-baseline sm:gap-10"
                >
                  <h4 className={`text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{s.heading}</h4>
                  <p className={`whitespace-pre-line text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                    {s.body}
                  </p>
                </RevealV2>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
