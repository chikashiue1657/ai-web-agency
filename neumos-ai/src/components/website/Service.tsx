import type { WebsiteSection } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";

export function Service({ sections, offer, theme }: { sections: WebsiteSection[]; offer: string; theme: WebsiteTheme }) {
  return (
    <section id="service" className={theme.altSectionBg}>
      <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>Service</p>
          <h2 className={`mt-3 text-2xl text-gray-900 sm:text-3xl ${theme.headingFont}`}>メニュー・サービス</h2>
          <p className="mt-4 text-sm text-gray-500 sm:text-base">{offer}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.id} className={`border bg-white p-6 shadow-sm transition hover:shadow-md ${theme.cardBorder} ${theme.radius}`}>
              <h3 className="text-lg font-semibold text-gray-900">{s.heading}</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
