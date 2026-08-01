import type { StoreRealData } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";

function compactAddress(address: string): string {
  return address.replace(/^〒\d{3}-?\d{4}\s*/, "");
}

export function StoreFactsV2({ realData, area, theme }: { realData?: StoreRealData; area: string; theme: CafeThemeV2 }) {
  const facts = [
    realData?.googleRating && realData.googleReviewCount
      ? { label: "Google", value: `★ ${realData.googleRating.toFixed(1)}`, note: `${realData.googleReviewCount}件` }
      : null,
    { label: "Area", value: realData?.address ? compactAddress(realData.address) : area, note: "" },
    realData?.openingHours?.[0] ? { label: "Hours", value: realData.openingHours[0], note: "曜日別はアクセス欄へ" } : null,
  ].filter((fact): fact is { label: string; value: string; note: string } => Boolean(fact));

  if (facts.length < 2) return null;
  return (
    <section aria-label="店舗の基本情報" className={`${theme.paperRaisedBg} border-y border-stone-200`}>
      <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-stone-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
        {facts.map((fact) => (
          <div key={fact.label} className="py-5 sm:px-6 sm:py-6 first:sm:pl-0 last:sm:pr-0">
            <dt className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${theme.accentText}`}>{fact.label}</dt>
            <dd className={`mt-2 text-sm font-medium sm:text-base ${theme.bodyText}`}>{fact.value}</dd>
            {fact.note && <dd className={`mt-1 text-xs ${theme.bodyTextSoft}`}>{fact.note}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
