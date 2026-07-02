import type { WebsiteSection } from "@/lib/types";
import { splitBulletLines } from "./utils";

export function Feature({ sections }: { sections: WebsiteSection[] }) {
  const items = sections.flatMap((s) => splitBulletLines(s.body));

  return (
    <section id="feature" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Feature</p>
        <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">選ばれる理由</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <span className="text-4xl font-extrabold text-brand-100">{String(i + 1).padStart(2, "0")}</span>
            <p className="mt-3 text-sm leading-relaxed text-gray-700 sm:text-base">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
