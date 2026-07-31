import type { GalleryItem } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";
import { ImagePlaceholder } from "./ImagePlaceholder";
import { GooglePhotoAttributionV2 } from "@/components/website-v2/GooglePhotoAttributionV2";

export function Gallery({
  items,
  theme,
  photoUrls,
}: {
  items: GalleryItem[];
  theme: WebsiteTheme;
  /** Googleの実写真URL。あるものはプレースホルダーの代わりにそのまま使う。 */
  photoUrls?: string[];
}) {
  const hasRealPhotos = (photoUrls?.length ?? 0) > 0;

  return (
    <section id="gallery" className={theme.altSectionBg}>
      <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>Gallery</p>
          <h2 className={`mt-3 text-2xl text-gray-900 sm:text-3xl ${theme.headingFont}`}>ギャラリー</h2>
          {!hasRealPhotos && (
            <p className="mt-4 text-sm text-gray-500">
              ※実際の店舗写真に差し替えてご利用ください（現在はイメージ枠を表示しています）。
            </p>
          )}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {items.map((item, i) => {
            const photoUrl = photoUrls?.[i];
            return (
              <figure key={item.id} className={`overflow-hidden ${theme.radius}`}>
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={item.altText} className="aspect-square w-full object-cover" />
                ) : (
                  <ImagePlaceholder
                    label={item.altText}
                    gradient={theme.galleryGradients[i % theme.galleryGradients.length]}
                    className="aspect-square"
                  />
                )}
                {photoUrl ? <GooglePhotoAttributionV2 photoUrl={photoUrl} /> : null}
                <figcaption className="mt-2 text-center text-xs text-gray-600 sm:text-sm">{item.caption}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
