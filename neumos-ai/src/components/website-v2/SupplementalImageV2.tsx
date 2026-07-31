import type { SupplementalImage } from "@/lib/types";
import { SafeImageV2 } from "./SafeImageV2";

export function SupplementalImageV2({ image }: { image?: SupplementalImage }) {
  if (!image) return null;
  return (
    <section id="supplemental-image" className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
      <figure className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem] md:items-end">
        <div className="relative aspect-[3/2] overflow-hidden bg-stone-200"><SafeImageV2 src={image.url} alt={image.altText} className="h-full w-full object-cover" /></div>
        <figcaption className="border-t border-current/20 pt-4 text-xs leading-relaxed opacity-75"><span className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.2em]">Editorial image</span>{image.disclosure}</figcaption>
      </figure>
    </section>
  );
}
