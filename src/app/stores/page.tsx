import { createClient } from '@/lib/supabase/server'
import { StoreTable } from '@/components/stores/store-table'
import { StoreFilters } from '@/components/stores/store-filters'
import Link from 'next/link'
import type { StoreWithLead, PriorityRank, LeadStatus } from '@/types'

interface PageProps {
  searchParams: Promise<{
    search?: string
    category?: string
    area?: string
    priority_rank?: string
    has_website?: string
    status?: string
    page?: string
    sort_by?: string
    sort_order?: string
  }>
}

const PER_PAGE = 30

export default async function StoresPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const offset = (page - 1) * PER_PAGE
  const supabase = await createClient()

  let query = supabase
    .from('stores')
    .select('*, lead:leads(*)', { count: 'exact' })

  if (params.search) query = query.ilike('name', `%${params.search}%`)
  if (params.category) query = query.eq('category', params.category)
  if (params.area) query = query.eq('area', params.area)
  if (params.has_website) query = query.eq('has_website', params.has_website === 'true')

  const sortBy = (params.sort_by as 'rating' | 'review_count' | 'created_at') ?? 'created_at'
  const sortAsc = params.sort_order === 'asc'

  const { data: rawData, count } = await query
    .order(sortBy, { ascending: sortAsc })
    .range(offset, offset + PER_PAGE - 1)

  let stores = (rawData ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    lead: Array.isArray(row.lead) ? (row.lead[0] ?? null) : (row.lead ?? null),
  })) as StoreWithLead[]

  // post-filter (優先度・ステータス)
  if (params.priority_rank) {
    stores = stores.filter((s) => s.lead?.priority_rank === (params.priority_rank as PriorityRank))
  }
  if (params.status) {
    stores = stores.filter((s) => s.lead?.status === (params.status as LeadStatus))
  }

  const total = count ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">店舗一覧</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()}件</p>
        </div>
        <Link
          href="/stores/new"
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          + 店舗追加
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <StoreFilters />
        </div>
        <StoreTable stores={stores} />

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {offset + 1}〜{Math.min(offset + PER_PAGE, total)}件 / 全{total}件
            </p>
            <div className="flex gap-1">
              {page > 1 && (
                <Link
                  href={`/stores?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  前へ
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/stores?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                >
                  次へ
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
