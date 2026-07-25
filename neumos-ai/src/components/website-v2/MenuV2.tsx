import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * メニュー・楽しみ方。v1のServiceのような同幅カードの反復をやめ、
 * 「左に品名（メニュー板のように大きく）／右に説明」というレストランの
 * メニュー表に近い2カラム構成にする。品目ごとの実写真はGoogle Placesから
 * 個別に取得できないため、写真を捏造せず文字だけで組む。
 */
export function MenuV2({ sections, offer, theme }: { sections: WebsiteSection[]; offer: string; theme: CafeThemeV2 }) {
  if (sections.length === 0) return null;

  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-10 sm:py-24 lg:px-16">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Menu</p>
        <h2 className={`mt-4 text-2xl sm:text-3xl ${theme.displayFont} ${theme.bodyText}`}>メニュー・楽しみ方</h2>
        {offer && (
          <p className={`mt-3 max-w-[42ch] break-keep break-words text-sm sm:text-base ${theme.bodyTextSoft}`}>
            {offer}
          </p>
        )}

        {/*
          RevealV2は<div>を描画するため、<li>の外側に被せると<ul>の直接の子が
          <div>になり、支援技術向けのリスト構造が壊れる（axe-coreのlist/listitem
          違反として実際に検出された）。<li>自体はプレーンな直接の子のままにし、
          reveal演出は<li>の中身だけに適用する。
        */}
        <ul className="mt-12 divide-y divide-stone-200 border-t border-stone-200">
          {sections.map((s, i) => (
            <li key={s.id} className="py-7">
              <RevealV2
                variant="fade-up"
                delayMs={i * 60}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-baseline sm:gap-10"
              >
                <h3 className={`text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{s.heading}</h3>
                <p className={`whitespace-pre-line text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                  {s.body}
                </p>
              </RevealV2>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
