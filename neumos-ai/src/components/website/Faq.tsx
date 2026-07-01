import type { FaqItem } from "@/lib/types";

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">FAQ</p>
        <h2 className="mt-3 text-2xl font-bold text-gray-900 sm:text-3xl">よくある質問</h2>
      </div>

      <div className="mt-10 divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
        {items.map((item, i) => (
          <details key={i} className="group px-5 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-gray-900 sm:text-base">
              <span>Q. {item.question}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 shrink-0 text-brand-600 transition group-open:rotate-45"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" />
              </svg>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">A. {item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
