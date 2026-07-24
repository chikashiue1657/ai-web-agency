import type { ContactMethod, WebsiteCta } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";

export function Contact({
  cta,
  contactMethods,
  theme,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: WebsiteTheme;
}) {
  return (
    <section id="contact" className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
      <div className={`overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20 ${theme.ctaGradient} ${theme.radius}`}>
        <h2 className={`text-2xl text-white sm:text-3xl ${theme.headingFont}`}>{cta.headline}</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">{cta.body}</p>

        <a
          href={cta.href}
          className={`mt-8 inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold shadow-lg transition hover:bg-white/90 sm:text-base ${theme.accentText}`}
        >
          {cta.buttonLabel}
        </a>

        {contactMethods.length > 0 && (
          <ul className="mx-auto mt-10 flex max-w-xl flex-col flex-wrap items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {contactMethods.map((method) =>
              method.href ? (
                <li key={method.label}>
                  <a
                    href={method.href}
                    target={method.href.startsWith("http") ? "_blank" : undefined}
                    rel={method.href.startsWith("http") ? "noreferrer" : undefined}
                    className="inline-block rounded-full border border-white/30 px-4 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 sm:text-sm"
                  >
                    {method.label}
                  </a>
                </li>
              ) : (
                <li
                  key={method.label}
                  className="rounded-full border border-white/30 px-4 py-1.5 text-xs font-medium text-white/90 sm:text-sm"
                >
                  {method.label}
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
