import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { RevealV2 } from "./RevealV2";

/**
 * メニュー・楽しみ方。v1のServiceのような同幅カードの反復をやめ、
 * 実際のメニュー表のように罫線区切りのリストとして見せる。
 */
export function MenuV2({ sections, offer, theme }: { sections: WebsiteSection[]; offer: string; theme: CafeThemeV2 }) {
  if (sections.length === 0) return null;

  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-10 sm:py-24 lg:px-0">
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
        <ul className="mt-10 divide-y divide-stone-200 border-t border-stone-200">
          {sections.map((s) => (
            <li key={s.id} className="py-6">
              <RevealV2
                variant="fade"
                className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <h3 className={`text-base font-semibold sm:text-lg ${theme.bodyText}`}>{s.heading}</h3>
                <p className={`whitespace-pre-line text-sm leading-relaxed sm:max-w-md sm:text-right ${theme.bodyTextSoft}`}>
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
