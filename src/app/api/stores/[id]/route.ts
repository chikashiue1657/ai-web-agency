// GET /api/stores/[id] - 店舗詳細
// PATCH /api/stores/[id] - 店舗更新

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    const [leadsRes, proposalsRes, sitesRes, logsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(1),
      supabase.from('proposals').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('generated_sites').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(5),
      supabase.from('activity_logs').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(20),
    ])

    return NextResponse.json<ApiResponse<Record<string, unknown>>>({
      data: {
        store,
        lead: leadsRes.data?.[0] ?? null,
        proposals: proposalsRes.data ?? [],
        sites: sitesRes.data ?? [],
        activity_logs: logsRes.data ?? [],
      },
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/stores/[id]]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '店舗詳細の取得に失敗しました' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await req.json()

    // notes更新はleadsテーブルへ
    if ('notes' in body || 'status' in body || 'contact_method' in body || 'last_contacted_at' in body) {
      const { notes, status, contact_method, last_contacted_at, ...storeFields } = body

      const leadUpdate: Record<string, unknown> = {}
      if (notes !== undefined) leadUpdate.notes = notes
      if (status !== undefined) leadUpdate.status = status
      if (contact_method !== undefined) leadUpdate.contact_method = contact_method
      if (last_contacted_at !== undefined) leadUpdate.last_contacted_at = last_contacted_at

      if (Object.keys(leadUpdate).length > 0) {
        await supabase.from('leads').upsert({ store_id: id, ...leadUpdate }, { onConflict: 'store_id' })

        await supabase.from('activity_logs').insert({
          store_id: id,
          event_type: 'note_updated',
          payload: leadUpdate,
        })
      }

      if (Object.keys(storeFields).length > 0) {
        await supabase.from('stores').update(storeFields).eq('id', id)
      }

      return NextResponse.json<ApiResponse<{ ok: boolean }>>({ data: { ok: true }, error: null })
    }

    const { data, error } = await supabase
      .from('stores')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json<ApiResponse<typeof data>>({ data, error: null })
  } catch (err) {
    console.error('[PATCH /api/stores/[id]]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '店舗の更新に失敗しました' },
      { status: 500 }
    )
  }
}
