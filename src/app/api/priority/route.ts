// POST /api/priority - 優先度判定

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { evaluatePriority } from '@/lib/priority'
import type { ApiResponse, PriorityInput } from '@/types'

const PriorityRequestSchema = z.object({
  store_id: z.string().uuid(),
  use_llm: z.boolean().default(false),
})

const BatchRequestSchema = z.object({
  store_ids: z.array(z.string().uuid()),
  use_llm: z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    // バッチモード
    if ('store_ids' in body) {
      const parsed = BatchRequestSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: parsed.error.message },
          { status: 400 }
        )
      }

      const { store_ids, use_llm } = parsed.data

      const { data: stores, error } = await supabase
        .from('stores')
        .select('*')
        .in('id', store_ids)

      if (error) throw error

      const results = []
      for (const store of stores ?? []) {
        const input: PriorityInput = {
          store_id: store.id,
          name: store.name,
          category: store.category,
          rating: store.rating,
          review_count: store.review_count ?? 0,
          photo_count: store.photo_count ?? 0,
          has_website: store.has_website ?? false,
          instagram_url: store.instagram_url,
          facebook_url: store.facebook_url,
          area: store.area,
          opening_hours: store.opening_hours,
        }

        const result = await evaluatePriority(input, { useLlm: use_llm })

        const { data: lead } = await supabase
          .from('leads')
          .upsert({
            store_id: store.id,
            priority_rank: result.priority_rank,
            score: result.score,
            reasons: result.reasons,
            sales_angle: result.sales_angle,
            risk_flags: result.risk_flags,
          }, { onConflict: 'store_id' })
          .select()
          .single()

        await supabase.from('activity_logs').insert({
          store_id: store.id,
          event_type: 'priority_evaluated',
          payload: { priority_rank: result.priority_rank, score: result.score, use_llm },
        })

        results.push({ store_id: store.id, result, lead })
      }

      return NextResponse.json<ApiResponse<typeof results>>({ data: results, error: null })
    }

    // 単体モード
    const parsed = PriorityRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const { store_id, use_llm } = parsed.data

    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single()

    if (error) throw error

    const input: PriorityInput = {
      store_id: store.id,
      name: store.name,
      category: store.category,
      rating: store.rating,
      review_count: store.review_count ?? 0,
      photo_count: store.photo_count ?? 0,
      has_website: store.has_website ?? false,
      instagram_url: store.instagram_url,
      facebook_url: store.facebook_url,
      area: store.area,
      opening_hours: store.opening_hours,
    }

    const result = await evaluatePriority(input, { useLlm: use_llm })

    const { data: lead } = await supabase
      .from('leads')
      .upsert({
        store_id,
        priority_rank: result.priority_rank,
        score: result.score,
        reasons: result.reasons,
        sales_angle: result.sales_angle,
        risk_flags: result.risk_flags,
      }, { onConflict: 'store_id' })
      .select()
      .single()

    await supabase.from('activity_logs').insert({
      store_id,
      event_type: 'priority_evaluated',
      payload: { priority_rank: result.priority_rank, score: result.score, use_llm },
    })

    return NextResponse.json<ApiResponse<{ result: typeof result; lead: typeof lead }>>({
      data: { result, lead },
      error: null,
    })
  } catch (err) {
    console.error('[POST /api/priority]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '優先度判定に失敗しました' },
      { status: 500 }
    )
  }
}
