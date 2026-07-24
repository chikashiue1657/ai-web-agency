import type { StoreRealData } from "@/lib/types";
import type { WebsiteTheme } from "@/lib/theme";

/**
 * 営業時間・定休日・電話番号・住所・Instagram・Google評価/レビュー件数を
 * カード表示する。実データ（Google等から取得できた項目）が無い場合は
 * カードごと非表示にし、一部の項目だけ無い場合はその項目だけ省略する
 * （取得できない情報を捏造しないため）。
 */
export function StoreInfoCard({ realData, theme }: { realData?: StoreRealData; theme: WebsiteTheme }) {
  if (!realData) return null;

  const rows: { label: string; value: string }[] = [];
  if (realData.openingHours?.length) rows.push({ label: "営業時間", value: realData.openingHours.join(" / ") });
  if (realData.closedDays) rows.push({ label: "定休日", value: realData.closedDays });
  if (realData.phone) rows.push({ label: "電話番号", value: realData.phone });
  if (realData.address) rows.push({ label: "住所", value: realData.address });
  if (typeof realData.googleRating === "number") {
    const reviewSuffix = realData.googleReviewCount ? `（${realData.googleReviewCount}件のレビュー）` : "";
    rows.push({ label: "Google評価", value: `★${realData.googleRating.toFixed(1)}${reviewSuffix}` });
  } else if (realData.googleReviewCount) {
    rows.push({ label: "Googleレビュー件数", value: `${realData.googleReviewCount}件` });
  }

  if (rows.length === 0 && !realData.instagramUrl) return null;

  return (
    <div className={`rounded-2xl border p-6 ${theme.cardBg} ${theme.cardBorder}`}>
      <p className={`text-sm font-semibold uppercase tracking-widest ${theme.accentText}`}>Store Info</p>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 text-sm sm:text-base">
            <dt className="w-24 shrink-0 font-medium text-gray-500">{row.label}</dt>
            <dd className="text-gray-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      {realData.instagramUrl && (
        <a
          href={realData.instagramUrl}
          target="_blank"
          rel="noreferrer"
          className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${theme.accentText} hover:underline`}
        >
          Instagramを見る ↗
        </a>
      )}
    </div>
  );
}
