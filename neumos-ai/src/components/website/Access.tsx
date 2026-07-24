import type { AccessInfo } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";

export function Access({ access, storeName, theme }: { access: AccessInfo; storeName: string; theme: WebsiteTheme }) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(access.mapQuery)}&output=embed`;

  return (
    <section id="access" className={theme.altSectionBg}>
      <div className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${theme.sectionPadding}`}>
        <div className="mx-auto max-w-2xl text-center">
          <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>Access</p>
          <h2 className={`mt-3 text-2xl text-gray-900 sm:text-3xl ${theme.headingFont}`}>アクセス</h2>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-8 md:grid-cols-2">
          <div className={`flex flex-col justify-center bg-white p-6 shadow-sm sm:p-8 ${theme.radius}`}>
            <p className={`text-sm font-semibold ${theme.accentText}`}>{storeName}</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{access.areaLabel}</p>
            <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">{access.addressHint}</p>
          </div>
          <div className={`min-h-[280px] overflow-hidden border border-gray-200 shadow-sm ${theme.radius}`}>
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
