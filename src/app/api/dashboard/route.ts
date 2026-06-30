// GET /api/dashboard - ダッシュボード統計

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, DashboardStats } from '@/types'

export async function GET() {
  try {
    const supabase = await createClient()

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const [
      totalRes,
      noWebsiteRes,
      newThisWeekRes,
      priorityARes,
      priorityBRes,
      priorityCRes,
      proposalsRes,
      sitesRes,
    ] = await Promise.all([
      supabase.from('stores').select('id', { count: 'exact', head: true }),
      supabase.from('stores').select('id', { count: 'exact', head: true }).eq('has_website', false),
      supabase.from('stores').select('id', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'A'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'B'),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('priority_rank', 'C'),
      supabase.from('proposals').select('id', { count: 'exact', head: true }),
      supabase.from('generated_sites').select('id', { count: 'exact', head: true }),
    ])

    const stats: DashboardStats = {
      total_stores: totalRes.count ?? 0,
      no_website: noWebsiteRes.count ?? 0,
      new_this_week: newThisWeekRes.count ?? 0,
      priority_a: priorityARes.count ?? 0,
      priority_b: priorityBRes.count ?? 0,
      priority_c: priorityCRes.count ?? 0,
      proposals_generated: proposalsRes.count ?? 0,
      sites_generated: sitesRes.count ?? 0,
    }

    return NextResponse.json<ApiResponse<DashboardStats>>({ data: stats, error: null })
  } catch (err) {
    console.error('[GET /api/dashboard]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'ダッシュボードデータの取得に失敗しました' },
      { status: 500 }
    )
  }
}
