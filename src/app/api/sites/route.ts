// POST /api/sites - 仮デモサイト生成

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { buildGeneratedSite } from '@/lib/sites'
import type { ApiResponse, ThemeType } from '@/types'

const SiteRequestSchema = z.object({
  store_id: z.string().uuid(),
  theme_type: z.enum(['japanese', 'modern', 'resort', 'clean', 'luxury', 'natural', 'trustworthy']).optional(),
  language: z.string().default('ja'),
  review_summary: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const parsed = SiteRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const { store_id, theme_type, language, review_summary } = parsed.data

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single()

    if (storeError) throw storeError

    const siteData = buildGeneratedSite(
      { store, theme_type: theme_type as ThemeType | undefined, language, review_summary },
      store_id
    )

    const { data: site, error: insertError } = await supabase
      .from('generated_sites')
      .insert(siteData)
      .select()
      .single()

    if (insertError) throw insertError

    await supabase.from('activity_logs').insert({
      store_id,
      event_type: 'site_generated',
      payload: { site_id: site.id, slug: site.slug, theme_type: site.theme_type },
    })

    return NextResponse.json<ApiResponse<typeof site>>(
      { data: site, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/sites]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '仮サイトの生成に失敗しました' },
      { status: 500 }
    )
  }
}
