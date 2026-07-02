import type { GalleryItem } from "@/lib/types";

const GRADIENTS = [
  "from-brand-500 to-purple-700",
  "from-fuchsia-500 to-brand-700",
  "from-indigo-500 to-brand-600",
  "from-brand-600 to-pink-600",
  "from-purple-600 to-brand-500",
  "from-violet-500 to-brand-700",
];

export function Gallery({ items }: { items: GalleryItem[] }) {
  return (
    <section id="gallery" className="bg-gray-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Gallery</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">ギャラリー</h2>
          <p className="mt-4 text-sm text-gray-500">
            ※実際の店舗写真に差し替えてご利用ください（現在はイメージ枠を表示しています）。
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {items.map((item, i) => (
            <figure key={item.id} className="overflow-hidden rounded-2xl">
              <div
                role="img"
                aria-label={item.altText}
                className={`flex aspect-square items-center justify-center bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-white/70 sm:h-10 sm:w-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7h3l1.5-2h9L18 7h3v13H3V7z"
                  />
                  <circle cx="12" cy="13" r="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <figcaption className="mt-2 text-center text-xs text-gray-600 sm:text-sm">{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
