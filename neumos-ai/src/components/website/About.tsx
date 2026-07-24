import type { WebsiteSection } from "@/lib/types";
import { splitBulletLines } from "./utils";
import { ImagePlaceholder } from "./ImagePlaceholder";

export function About({
  storeName,
  concept,
  sections,
}: {
  storeName: string;
  concept: string;
  sections: WebsiteSection[];
}) {
  const points = sections.flatMap((s) => splitBulletLines(s.body));

  return (
    <section id="about" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <ImagePlaceholder
            label={`${storeName}の店舗紹介`}
            gradient="from-brand-500 to-purple-700"
            className="mb-8 aspect-video w-full rounded-2xl"
          />
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">About</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">私たちについて</h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600 sm:text-lg">{concept}</p>
        </div>
        <ul className="space-y-4">
          {points.map((point, i) => (
            <li key={i} className="flex gap-3 rounded-xl bg-brand-50 p-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-gray-700 sm:text-base">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
