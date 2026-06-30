// POST /api/normalize - 店舗データ正規化 + upsert

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { normalizeStore, type RawInput } from '@/lib/normalize'
import type { ApiResponse } from '@/types'

const InputSchema = z.object({
  type: z.enum(['google_places', 'apify', 'csv']),
  data: z.record(z.string(), z.unknown()),
  batch: z.array(z.record(z.string(), z.unknown())).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const parsed = InputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const items: RawInput[] = parsed.data.batch
      ? parsed.data.batch.map((d) => ({ type: parsed.data.type, data: d } as RawInput))
      : [{ type: parsed.data.type, data: parsed.data.data } as RawInput]

    const normalized = items.map((item) => normalizeStore(item))

    const results: unknown[] = []

    for (const store of normalized) {
      // place_id が有る場合は upsert
      if (store.place_id) {
        const { data, error } = await supabase
          .from('stores')
          .upsert(store, { onConflict: 'place_id' })
          .select()
          .single()

        if (error) {
          console.error('[normalize] upsert error:', error)
          continue
        }

        await supabase.from('activity_logs').insert({
          store_id: data.id,
          event_type: 'store_imported',
          payload: { source: store.source, name: store.name },
        })

        results.push(data)
        continue
      }

      // place_id なし: name+address で重複チェック
      if (store.name && store.address) {
        const { data: existing } = await supabase
          .from('stores')
          .select('id')
          .ilike('name', store.name)
          .ilike('address', store.address)
          .limit(1)
          .single()

        if (existing) {
          const { data, error } = await supabase
            .from('stores')
            .update(store)
            .eq('id', existing.id)
            .select()
            .single()

          if (!error && data) {
            results.push(data)
            continue
          }
        }
      }

      // 新規insert
      const { data, error } = await supabase
        .from('stores')
        .insert(store)
        .select()
        .single()

      if (error) {
        console.error('[normalize] insert error:', error)
        continue
      }

      await supabase.from('activity_logs').insert({
        store_id: data.id,
        event_type: 'store_imported',
        payload: { source: store.source, name: store.name },
      })

      results.push(data)
    }

    return NextResponse.json<ApiResponse<unknown[]>>({ data: results, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/normalize]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'データ正規化に失敗しました' },
      { status: 500 }
    )
  }
}
