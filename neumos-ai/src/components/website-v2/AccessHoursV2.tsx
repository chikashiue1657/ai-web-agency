import type { AccessInfo, StoreRealData } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";

/**
 * 営業時間・定休日・電話・住所（Access + v1のStoreInfoCard相当）を1つに統合。
 * v1のような左右1:1の白カード+shadowではなく、テキスト側を狭く・地図側を
 * 広くした非対称の2分割にし、区切りは背景色ではなく罫線1本にする。
 * realDataに無い項目はここでも表示しない（捏造しない）。
 */
export function AccessHoursV2({
  storeName,
  access,
  realData,
  theme,
}: {
  storeName: string;
  access: AccessInfo;
  realData?: StoreRealData;
  theme: CafeThemeV2;
}) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(access.mapQuery)}&output=embed`;

  // 必要最低限だけ表示する：営業時間と定休日は別々の行にせず1行にまとめる
  // （営業時間・定休日・電話・住所の4行がすべて並ぶと情報過多に見えるため）。
  const rows: { label: string; value: string; href?: string }[] = [];
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
            <dl className="flex flex-col gap-3 border-t border-stone-200 pt-6">
              {rows.map((row) => (
                <div key={row.label} className="flex gap-4 text-sm sm:text-base">
                  <dt className={`w-16 shrink-0 ${theme.bodyTextSoft}`}>{row.label}</dt>
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
