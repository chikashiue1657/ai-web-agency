import type { AccessInfo } from "@/lib/types";

export function Access({ access, storeName }: { access: AccessInfo; storeName: string }) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(access.mapQuery)}&output=embed`;

  return (
    <section id="access" className="bg-gray-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Access</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">アクセス</h2>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-8 md:grid-cols-2">
          <div className="flex flex-col justify-center rounded-2xl bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-brand-700">{storeName}</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{access.areaLabel}</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">{access.addressHint}</p>
          </div>
          <div className="min-h-[280px] overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            <iframe
              title={`${storeName}の地図`}
              src={mapSrc}
              className="h-full min-h-[280px] w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
