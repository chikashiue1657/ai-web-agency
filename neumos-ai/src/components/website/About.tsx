import type { StoreRealData, WebsiteSection } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";
import { splitBulletLines } from "./utils";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { StoreInfoCard } from "./StoreInfoCard";
import { GooglePhotoAttributionV2 } from "@/components/website-v2/GooglePhotoAttributionV2";

export function About({
  storeName,
  concept,
  sections,
  theme,
  realData,
}: {
  storeName: string;
  concept: string;
  sections: WebsiteSection[];
  theme: WebsiteTheme;
  realData?: StoreRealData;
}) {
  const points = sections.flatMap((s) => splitBulletLines(s.body));
  const photoUrl = realData?.photoUrls?.[0];

  return (
    <section id="about" className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-16">
        <div>
          {photoUrl ? (
            <div className="mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={`${storeName}の店舗紹介`} className={`aspect-video w-full object-cover ${theme.radius}`} />
              <GooglePhotoAttributionV2 photoUrl={photoUrl} />
            </div>
          ) : (
            <ImagePlaceholder
              label={`${storeName}の店舗紹介`}
              gradient={theme.galleryGradients[0]}
              className={`mb-8 aspect-video w-full ${theme.radius}`}
            />
          )}
          <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>About</p>
          <h2 className={`mt-3 text-2xl text-gray-900 sm:text-3xl ${theme.headingFont}`}>私たちについて</h2>
          <p className="mt-6 text-base leading-relaxed text-gray-600 sm:text-lg">{concept}</p>
        </div>
        <ul className="space-y-4">
          {points.map((point, i) => (
            <li key={i} className={`flex gap-3 p-4 ${theme.cardBg} ${theme.radius}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${theme.heroGradient}`}>
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-gray-700 sm:text-base">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      {realData && (
        <div className="mt-10">
          <StoreInfoCard realData={realData} theme={theme} />
        </div>
      )}
    </section>
  );
}
