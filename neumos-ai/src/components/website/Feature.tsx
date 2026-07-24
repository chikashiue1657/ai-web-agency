import type { WebsiteSection } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";
import { splitBulletLines } from "./utils";

export function Feature({ sections, theme }: { sections: WebsiteSection[]; theme: WebsiteTheme }) {
  const items = sections.flatMap((s) => splitBulletLines(s.body));

  return (
    <section id="feature" className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
      <div className="mx-auto max-w-2xl text-center">
        <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>Feature</p>
        <h2 className={`mt-3 text-2xl text-gray-900 sm:text-3xl ${theme.headingFont}`}>選ばれる理由</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className={`relative bg-white p-6 shadow-sm ring-1 ${theme.cardBorder} ${theme.radius}`}>
            <span className={`text-4xl font-extrabold ${theme.numberAccent}`}>{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
