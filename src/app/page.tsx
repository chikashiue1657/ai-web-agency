import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/stat-card'
import Link from 'next/link'
import type { DashboardStats } from '@/types'

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const supabase = await createClient()
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [total, noWebsite, newThisWeek, prioA, prioB, prioC, proposals, sites] =
      await Promise.all([
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('stores').select('id', { count: 'exact', head: true }).eq('has_website', false),
        supabase.from('stores').select('id', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'A'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'B'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'C'),
        supabase.from('proposals').select('id', { count: 'exact', head: true }),
        supabase.from('generated_sites').select('id', { count: 'exact', head: true }),
      ])

    return {
      total_stores: total.count ?? 0,
      no_website: noWebsite.count ?? 0,
      new_this_week: newThisWeek.count ?? 0,
      priority_a: prioA.count ?? 0,
      priority_b: prioB.count ?? 0,
      priority_c: prioC.count ?? 0,
      proposals_generated: proposals.count ?? 0,
      sites_generated: sites.count ?? 0,
    }
  } catch {
    return {
      total_stores: 0, no_website: 0, new_this_week: 0,
      priority_a: 0, priority_b: 0, priority_c: 0,
      proposals_generated: 0, sites_generated: 0,
    }
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">AI集客支援サービス 営業管理</p>
      </div>

      {/* 主要KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="総店舗数" value={stats.total_stores} description="登録済み" />
        <StatCard title="HPなし" value={stats.no_website} description="集客改善余地あり" />
        <StatCard title="今週の新規" value={stats.new_this_week} description="過去7日間" />
        <StatCard title="提案書生成済み" value={stats.proposals_generated} />
      </div>

      {/* 優先度内訳 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="優先度 A" value={stats.priority_a} description="即アプローチ" variant="a" />
        <StatCard title="優先度 B" value={stats.priority_b} description="近日中にアプローチ" variant="b" />
        <StatCard title="優先度 C" value={stats.priority_c} description="長期ウォッチ" variant="c" />
      </div>

      {/* 生成状況 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard title="仮サイト生成済み" value={stats.sites_generated} />
        <StatCard title="未判定店舗" value={Math.max(0, stats.total_stores - stats.priority_a - stats.priority_b - stats.priority_c)} description="優先度未設定" />
      </div>

      {/* クイックアクション */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">クイックアクション</h3>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/stores"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            店舗一覧を見る
          </Link>
          <Link
            href="/stores?has_website=false"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            HPなし店舗を絞り込む
          </Link>
          <Link
            href="/stores?priority_rank=A"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
          >
            優先度A 一覧
          </Link>
        </div>
      </div>
    </div>
  )
}
