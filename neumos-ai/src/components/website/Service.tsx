import type { WebsiteSection } from "@/lib/types";

export function Service({ sections, offer }: { sections: WebsiteSection[]; offer: string }) {
  return (
    <section id="service" className="bg-gray-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">Service</p>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">メニュー・サービス</h2>
          <p className="mt-4 text-sm text-gray-500 sm:text-base">{offer}</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
              <h3 className="text-lg font-semibold text-gray-900">{s.heading}</h3>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
