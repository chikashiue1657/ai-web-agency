// POST /api/seed - ダミーデータ投入（開発用）
// 本番では無効にすること

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DUMMY_STORES } from '@/lib/seed/dummy-stores'
import { evaluatePriority } from '@/lib/priority'
import type { ApiResponse, PriorityInput } from '@/types'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '本番環境では使用できません' }, { status: 403 })
  }

  try {
    const supabase = await createClient()
    const results = []

    for (const store of DUMMY_STORES) {
      const { data: inserted } = await supabase
        .from('stores')
        .upsert(store, { onConflict: 'place_id' })
        .select()
        .single()

      if (!inserted) continue

      // 優先度判定
      const input: PriorityInput = {
        store_id: inserted.id,
        name: inserted.name,
        category: inserted.category,
        rating: inserted.rating,
        review_count: inserted.review_count ?? 0,
        photo_count: inserted.photo_count ?? 0,
        has_website: inserted.has_website ?? false,
        instagram_url: inserted.instagram_url,
        facebook_url: inserted.facebook_url,
        area: inserted.area,
        opening_hours: inserted.opening_hours,
      }
      const priority = await evaluatePriority(input, { useLlm: false })

      await supabase.from('leads').upsert({
        store_id: inserted.id,
        priority_rank: priority.priority_rank,
        score: priority.score,
        reasons: priority.reasons,
        sales_angle: priority.sales_angle,
        risk_flags: priority.risk_flags,
        status: 'new',
      }, { onConflict: 'store_id' })

      await supabase.from('activity_logs').insert({
        store_id: inserted.id,
        event_type: 'store_imported',
        payload: { source: 'seed', name: inserted.name },
      })

      results.push({ id: inserted.id, name: inserted.name, priority: priority.priority_rank })
    }

    return NextResponse.json<ApiResponse<typeof results>>(
      { data: results, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/seed]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'シードデータ投入に失敗しました' },
      { status: 500 }
    )
  }
}
