/**
 * 店舗一覧（サーバコンポーネント）。
 * - URLクエリでフィルタ/ソートを受け取り、テーブル表示。
 * - 行クリックで詳細へ遷移。
 */
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import type { StoreListFilters } from "@/lib/repo";
import type { PriorityRank, LeadStatus } from "@/lib/types";
import { PriorityBadge, StatusBadge, YesNo, categoryLabel } from "@/components/ui";
import { StoreFilters } from "./filters";

export const dynamic = "force-dynamic";

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return s.slice(0, 10);
}

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const repo = getRepo();
  const filters: StoreListFilters = {
    q: searchParams.q,
    category: searchParams.category,
    area: searchParams.area,
    priority: searchParams.priority as PriorityRank | undefined,
    hasWebsite:
      searchParams.has_website == null
        ? undefined
        : searchParams.has_website === "true",
    status: searchParams.status as LeadStatus | undefined,
    sort: (searchParams.sort as StoreListFilters["sort"]) ?? "score_desc",
  };

  const stores = await repo.listStores(filters);
  // エリア候補（フィルタ用）は全件から抽出
  const allStores = await repo.listStores();
  const areas = [...new Set(allStores.map((s) => s.area).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">店舗一覧</h1>
        <span className="text-sm text-gray-500">{stores.length}件</span>
      </div>

      <StoreFilters areas={areas} />

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              <th className="px-3 py-2 font-medium">店名</th>
              <th className="px-3 py-2 font-medium">業種</th>
              <th className="px-3 py-2 font-medium">エリア</th>
              <th className="px-3 py-2 font-medium text-right">評価</th>
              <th className="px-3 py-2 font-medium text-right">口コミ</th>
              <th className="px-3 py-2 font-medium text-right">写真</th>
              <th className="px-3 py-2 font-medium text-center">HP</th>
              <th className="px-3 py-2 font-medium text-center">IG</th>
              <th className="px-3 py-2 font-medium text-center">FB</th>
              <th className="px-3 py-2 font-medium text-center">優先度</th>
              <th className="px-3 py-2 font-medium text-right">スコア</th>
              <th className="px-3 py-2 font-medium">ステータス</th>
              <th className="px-3 py-2 font-medium">最終接触</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} className="border-t border-gray-100 hover:bg-brand-50">
                <td className="px-3 py-2">
                  <Link href={`/stores/${s.id}`} className="text-brand-600 hover:underline font-medium">
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{categoryLabel(s.category)}</td>
                <td className="px-3 py-2">{s.area ?? "-"}</td>
                <td className="px-3 py-2 text-right">{s.rating ?? "-"}</td>
                <td className="px-3 py-2 text-right">{s.review_count}</td>
                <td className="px-3 py-2 text-right">{s.photo_count}</td>
                <td className="px-3 py-2 text-center"><YesNo value={s.has_website} /></td>
                <td className="px-3 py-2 text-center"><YesNo value={!!s.instagram_url} /></td>
                <td className="px-3 py-2 text-center"><YesNo value={!!s.facebook_url} /></td>
                <td className="px-3 py-2 text-center"><PriorityBadge rank={s.lead?.priority_rank} /></td>
                <td className="px-3 py-2 text-right">{s.lead?.score ?? "-"}</td>
                <td className="px-3 py-2"><StatusBadge status={s.lead?.status} /></td>
                <td className="px-3 py-2 text-gray-500">{fmtDate(s.lead?.last_contacted_at ?? null)}</td>
              </tr>
            ))}
            {stores.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-400">
                  条件に一致する店舗がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
