/**
 * ダッシュボード（サーバコンポーネント）。
 * 総店舗数 / A・B・C件数 / HPなし件数 / 今週の新規 / 提案書生成済み件数 を表示。
 */
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { StatCard } from "@/components/ui";

// 常に最新の集計を表示（モックDBでも反映されるよう動的レンダリング）
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getRepo().getDashboardStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ダッシュボード</h1>
        <Link
          href="/stores"
          className="text-sm px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700"
        >
          店舗一覧へ
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="総店舗数" value={stats.total} />
        <StatCard label="優先度A" value={stats.rankA} hint="最優先で営業" />
        <StatCard label="優先度B" value={stats.rankB} />
        <StatCard label="優先度C" value={stats.rankC} />
        <StatCard label="HPなし" value={stats.noWebsite} hint="主対象" />
        <StatCard label="提案書生成済み" value={stats.proposalsGenerated} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="今週の新規取り込み" value={stats.newThisWeek} hint="直近7日" />
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-800 mb-1">運用フロー</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            <li>店舗候補を取り込み（API / CSV）</li>
            <li>優先度判定（A/B/C）</li>
            <li>提案書・仮サイトを生成</li>
            <li>人間が確認のうえ営業</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
