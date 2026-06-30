// GET /api/stores - 店舗一覧
// POST /api/stores - 店舗登録

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { StoreFilters, ApiResponse, PaginatedResponse, StoreWithLead } from '@/types'

const FiltersSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  area: z.string().optional(),
  priority_rank: z.enum(['A', 'B', 'C']).optional(),
  has_website: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['rating', 'review_count', 'created_at', 'score']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const params = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = FiltersSchema.safeParse(params)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const { search, category, area, priority_rank, has_website, status, page, per_page, sort_by, sort_order } = parsed.data
    const offset = (page - 1) * per_page

    let query = supabase
      .from('stores')
      .select(`
        *,
        lead:leads(*)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (area) {
      query = query.eq('area', area)
    }
    if (has_website !== undefined) {
      query = query.eq('has_website', has_website === 'true')
    }

    // リード絡みのフィルタは後処理
    const { data: rawData, count, error } = await query
      .order(sort_by === 'score' ? 'created_at' : sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + per_page - 1)

    if (error) throw error

    // leads は配列で返るため先頭だけ取る
    let stores = (rawData ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      lead: Array.isArray(row.lead) ? (row.lead[0] ?? null) : (row.lead ?? null),
    })) as StoreWithLead[]

    // 優先度フィルタ（post-filter）
    if (priority_rank) {
      stores = stores.filter((s) => s.lead?.priority_rank === priority_rank)
    }
    if (status) {
      stores = stores.filter((s) => s.lead?.status === status)
    }

    return NextResponse.json<ApiResponse<PaginatedResponse<StoreWithLead>>>({
      data: {
        data: stores,
        total: count ?? 0,
        page,
        per_page,
      },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/stores]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '店舗一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

const StoreCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  rating: z.number().optional(),
  review_count: z.number().int().default(0),
  photo_count: z.number().int().default(0),
  website_url: z.string().url().optional().nullable(),
  instagram_url: z.string().url().optional().nullable(),
  facebook_url: z.string().url().optional().nullable(),
  has_website: z.boolean().default(false),
  area: z.string().optional(),
  source: z.enum(['google_places', 'apify', 'csv', 'manual']).default('manual'),
  place_id: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const parsed = StoreCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(parsed.data)
      .select()
      .single()

    if (error) throw error

    // 活動履歴を記録
    await supabase.from('activity_logs').insert({
      store_id: data.id,
      event_type: 'store_imported',
      payload: { source: parsed.data.source, name: parsed.data.name },
    })

    return NextResponse.json<ApiResponse<typeof data>>(
      { data, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/stores]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '店舗の登録に失敗しました' },
      { status: 500 }
    )
  }
}
