import type { WebsiteCta } from "@/lib/types";

export function Contact({ cta, contactMethods }: { cta: WebsiteCta; contactMethods: string[] }) {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-14 text-center sm:px-12 sm:py-20">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{cta.headline}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">{cta.body}</p>

        <span className="mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg sm:text-base">
          {cta.buttonLabel}
        </span>

        <ul className="mx-auto mt-10 flex max-w-xl flex-col flex-wrap items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {contactMethods.map((method, i) => (
            <li
              key={i}
              className="rounded-full border border-white/30 px-4 py-1.5 text-xs font-medium text-white/90 sm:text-sm"
            >
              {method}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
