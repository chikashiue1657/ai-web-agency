import type { AccessInfo, StoreRealData } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, SurfaceClasses } from "@/lib/engine/v2-design-system";

/**
 * 営業時間・定休日・電話・住所（Access + v1のStoreInfoCard相当）を1つに統合。
 * realDataに無い項目はここでも表示しない（捏造しない）。行ごとに小さな
 * アイコンを添えて情報の種類を一目で分かるようにする。
 *
 * artDirectionごとにレイアウトそのものを変える。
 *  - japanese-editorial: 本の奥付（colophon）のような、中央寄せの静かな
 *    1カラム。地図は控えめに小さく添えるだけに留める。
 *  - sensory-immersive: 地図を主役級の大きな面として扱い、情報カードを
 *    その上に重ねて一体化させる。
 *  - warm-craft: これまで通り、テキスト側を狭く・地図側を広くした
 *    非対称の2分割。
 */
const ROW_ICON: Record<"営業時間" | "定休日" | "電話" | "住所", string> = {
  営業時間: "M12 7v5l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  定休日: "M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  電話: "M3 5a2 2 0 012-2h2.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.05 11.05 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  住所: "M12 21c-4.418-4.03-7-7.686-7-11a7 7 0 1114 0c0 3.314-2.582 6.97-7 11z M12 11a2 2 0 100-4 2 2 0 000 4z",
};

type RowLabel = keyof typeof ROW_ICON;
interface Row {
  label: RowLabel;
  value: string;
  href?: string;
}

function RowIcon({ label, className }: { label: RowLabel; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ROW_ICON[label]} />
    </svg>
  );
}

function buildRows(realData?: StoreRealData): Row[] {
  const rows: Row[] = [];
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
  return rows;
}

/** japanese-editorial: 本の奥付のような、静かな中央寄せ1カラム。 */
function ColophonAccessHours({
  storeName,
  access,
  rows,
  mapSrc,
  theme,
  surface,
}: {
  storeName: string;
  access: AccessInfo;
  rows: Row[];
  mapSrc: string;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
}) {
  return (
    <section id="access" className={theme.paperBg}>
      <div className="mx-auto max-w-xl px-5 py-20 text-center sm:px-10 sm:py-28">
        <p className={`text-xs font-semibold uppercase tracking-[0.3em] ${theme.accentText}`}>Access</p>
        <div className={`mx-auto mt-6 w-10 border-t ${surface.divider}`} />
        <p className={`mt-6 text-lg sm:text-xl ${theme.displayFont} ${theme.bodyText}`}>{storeName}</p>
        <p className={`mt-1 text-sm ${theme.bodyTextSoft}`}>{access.areaLabel}</p>

        {rows.length > 0 && (
          <dl className="mt-8 flex flex-col items-center gap-3">
            {rows.map((row) => (
              <div key={row.label} className="flex items-baseline gap-3 text-sm">
                <dt className={`text-xs tracking-[0.15em] ${theme.bodyTextSoft}`}>{row.label}</dt>
                <dd className="[overflow-wrap:normal]">
                  {row.href ? (
                    <a href={row.href} className={`${theme.accentText} hover:underline`}>
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

        <div className={`mx-auto mt-10 w-10 border-t ${surface.divider}`} />

        <div className="mt-8 overflow-hidden rounded-sm">
          <iframe
            title={`${storeName}の地図`}
            src={mapSrc}
            className="h-64 w-full grayscale"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

/** sensory-immersive: 地図を主役級に大きく扱い、情報カードを重ねて一体化させる。 */
function ImmersiveAccessHours({
  storeName,
  access,
  rows,
  mapSrc,
  theme,
}: {
  storeName: string;
  access: AccessInfo;
  rows: Row[];
  mapSrc: string;
  theme: CafeThemeV2;
}) {
  return (
    <section id="access" className="relative w-full">
      <div className="relative h-[70vh] min-h-[480px] w-full">
        <iframe
          title={`${storeName}の地図`}
          src={mapSrc}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-stone-950/70 to-transparent" />
      </div>
      <div className="relative z-10 mx-4 -mt-24 max-w-md rounded-sm bg-stone-950/85 px-6 py-8 text-white backdrop-blur-sm sm:mx-10 sm:px-10 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Access</p>
        <p className={`mt-3 text-xl sm:text-2xl ${theme.displayFont}`}>{storeName}</p>
        <p className="mt-1 text-sm text-white/70">{access.areaLabel}</p>
        {rows.length > 0 && (
          <dl className="mt-6 flex flex-col gap-3 border-t border-white/20 pt-6">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start gap-3 text-sm">
                <RowIcon label={row.label} className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
                <dd className="[overflow-wrap:normal] text-white/85">
                  {row.href ? (
                    <a href={row.href} className="hover:underline">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/** warm-craft: テキスト側を狭く・地図側を広くした非対称の2分割（従来の構成）。 */
function CraftAccessHours({
  storeName,
  access,
  rows,
  mapSrc,
  theme,
  surface,
}: {
  storeName: string;
  access: AccessInfo;
  rows: Row[];
  mapSrc: string;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
}) {
  return (
    <section id="access" className={theme.paperRaisedBg}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-5">
        <div className="flex flex-col justify-center gap-6 px-5 py-14 sm:px-10 sm:py-20 lg:col-span-2 lg:px-16 lg:py-0">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Access</p>
            <p className={`mt-3 text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{storeName}</p>
            <p className={`mt-1 text-sm ${theme.bodyTextSoft}`}>{access.areaLabel}</p>
            {access.addressHint && (
              <p className={`mt-3 max-w-[36ch] [overflow-wrap:normal] text-sm leading-relaxed ${theme.bodyTextSoft}`}>
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
                    <dd className="[overflow-wrap:normal]">
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

export function AccessHoursV2({
  storeName,
  access,
  realData,
  theme,
  surface,
  artDirection,
}: {
  storeName: string;
  access: AccessInfo;
  realData?: StoreRealData;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  artDirection: ArtDirection;
}) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(access.mapQuery)}&output=embed`;
  // 必要最低限だけ表示する：営業時間と定休日は別々の行にせず1行にまとめる
  // （営業時間・定休日・電話・住所の4行がすべて並ぶと情報過多に見えるため）。
  const rows = buildRows(realData);

  if (artDirection === "japanese-editorial") {
    return <ColophonAccessHours storeName={storeName} access={access} rows={rows} mapSrc={mapSrc} theme={theme} surface={surface} />;
  }
  if (artDirection === "sensory-immersive") {
    return <ImmersiveAccessHours storeName={storeName} access={access} rows={rows} mapSrc={mapSrc} theme={theme} />;
  }
  return <CraftAccessHours storeName={storeName} access={access} rows={rows} mapSrc={mapSrc} theme={theme} surface={surface} />;
}
