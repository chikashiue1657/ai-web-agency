import type { AccessInfo, StoreRealData } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { SurfaceClasses } from "@/lib/engine/v2-design-system";

/**
 * 営業時間・定休日・電話・住所（Access + v1のStoreInfoCard相当）を1つに統合。
 * v1のような左右1:1の白カード+shadowではなく、テキスト側を狭く・地図側を
 * 広くした非対称の2分割にし、区切りは背景色ではなく罫線1本にする。
 * realDataに無い項目はここでも表示しない（捏造しない）。行ごとに小さな
 * アイコンを添えて情報の種類を一目で分かるようにする。
 */
const ROW_ICON: Record<"営業時間" | "定休日" | "電話" | "住所", string> = {
  営業時間: "M12 7v5l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  定休日: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  電話: "M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.05 11.05 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  住所: "M12 21c-4.418-4.03-7-7.686-7-11a7 7 0 1114 0c0 3.314-2.582 6.97-7 11z M12 11a2 2 0 100-4 2 2 0 000 4z",
};

function RowIcon({ label, className }: { label: keyof typeof ROW_ICON; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ROW_ICON[label]} />
    </svg>
  );
}

export function AccessHoursV2({
  storeName,
  access,
  realData,
  theme,
  surface,
}: {
  storeName: string;
  access: AccessInfo;
  realData?: StoreRealData;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
}) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(access.mapQuery)}&output=embed`;

  // 必要最低限だけ表示する：営業時間と定休日は別々の行にせず1行にまとめる
  // （営業時間・定休日・電話・住所の4行がすべて並ぶと情報過多に見えるため）。
  const rows: { label: keyof typeof ROW_ICON; value: string; href?: string }[] = [];
  if (realData?.openingHours?.length) {
    const hoursValue = realData.closedDays
      ? `${realData.openingHours.join(" / ")}（${realData.closedDays}）`
      : realData.openingHours.join(" / ");
    rows.push({ label: "営業時間", value: hoursValue });
  } else if (realData?.closedDays) {
    rows.push({ label: "定休日", value: realData.closedDays });
  }
  if (realData?.phone) rows.push({ label: "電話", value: realData.phone, href: `tel:${realData.phone}` });
  if (realData?.address) rows.push({ label: "住所", value: realData.address });

  return (
    <section id="access" className={theme.paperRaisedBg}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-5">
        <div className="flex flex-col justify-center gap-6 px-5 py-14 sm:px-10 sm:py-20 lg:col-span-2 lg:px-16 lg:py-0">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Access</p>
            <p className={`mt-3 text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{storeName}</p>
            <p className={`mt-1 text-sm ${theme.bodyTextSoft}`}>{access.areaLabel}</p>
            {access.addressHint && (
              <p className={`mt-3 max-w-[36ch] break-keep break-words text-sm leading-relaxed ${theme.bodyTextSoft}`}>
                {access.addressHint}
              </p>
            )}
          </div>

          {rows.length > 0 && (
            <dl className={`flex flex-col gap-4 border-t pt-6 ${surface.divider}`}>
              {rows.map((row) => (
                <div key={row.label} className="flex items-start gap-3 text-sm sm:text-base">
                  <RowIcon label={row.label} className={`mt-0.5 h-4 w-4 shrink-0 ${theme.accentTextSoft}`} />
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                    <dt className={`w-16 shrink-0 text-xs ${theme.bodyTextSoft}`}>{row.label}</dt>
                    <dd className="break-keep break-words">
                      {row.href ? (
                        <a href={row.href} className={`font-medium ${theme.accentText} hover:underline`}>
                          {row.value}
                        </a>
                      ) : (
                        <span className={theme.bodyText}>{row.value}</span>
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="min-h-[320px] lg:col-span-3">
          <iframe
            title={`${storeName}の地図`}
            src={mapSrc}
            className="h-full min-h-[320px] w-full grayscale-[15%]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}
