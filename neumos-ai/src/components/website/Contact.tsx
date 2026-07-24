import type { WebsiteCta } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";

export function Contact({ cta, contactMethods, theme }: { cta: WebsiteCta; contactMethods: string[]; theme: WebsiteTheme }) {
  return (
    <section id="contact" className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
      <div className={`overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20 ${theme.ctaGradient} ${theme.radius}`}>
        <h2 className={`text-2xl text-white sm:text-3xl ${theme.headingFont}`}>{cta.headline}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">{cta.body}</p>

        <span className={`mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold shadow-lg sm:text-base ${theme.accentText}`}>
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
