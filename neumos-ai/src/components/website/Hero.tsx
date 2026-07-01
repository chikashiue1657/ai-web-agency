export function Hero({
  heroTitle,
  heroSubtitle,
  ctaLabel,
  industry,
  area,
}: {
  heroTitle: string;
  heroSubtitle: string;
  ctaLabel: string;
  industry: string;
  area: string;
}) {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8 lg:py-36">
        <span className="mb-5 inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white sm:text-sm">
          {area} ・ {industry}
        </span>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
          {heroTitle}
        </h1>
        <p className="mt-6 max-w-2xl text-base text-white/90 sm:text-lg">{heroSubtitle}</p>
        <a
          href="#contact"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50 sm:text-base"
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}
