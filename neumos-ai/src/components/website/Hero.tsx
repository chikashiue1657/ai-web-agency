import type { WebsiteTheme } from "@/lib/theme";

export function Hero({
  heroTitle,
  heroSubtitle,
  ctaLabel,
  ctaHref,
  industry,
  area,
  theme,
}: {
  heroTitle: string;
  heroSubtitle: string;
  ctaLabel: string;
  /** 実データが無ければ"#contact"（ページ内アンカー、常に機能する）。 */
  ctaHref: string;
  industry: string;
  area: string;
  theme: WebsiteTheme;
}) {
  return (
    <section id="top" className={`relative overflow-hidden ${theme.heroGradient}`}>
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <span className="mb-5 inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white sm:text-sm">
          {area} ・ {industry}
        </span>
        {/*
          break-keep（word-break: keep-all）: 既定のCJK文字単位の折り返しだと、
          店名（英字+ハイフン等）や助詞の直前で不自然に割れることがあった
          （実例: 「毎日通いたくなるBB-」/「Coffee」、「酒場 大将の時」/「間を」）。
          単語・意味のまとまりを保ったまま折り返すようにする。
        */}
        <h1
          className={`max-w-3xl break-keep text-3xl leading-tight text-white sm:text-5xl lg:text-6xl ${theme.headingFont}`}
        >
          {heroTitle}
        </h1>
        <p className="mt-6 max-w-2xl break-keep text-base text-white/90 sm:text-lg">{heroSubtitle}</p>
        <a
          href={ctaHref}
          className={`mt-10 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold shadow-lg transition hover:bg-white/90 sm:text-base ${theme.accentText}`}
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
