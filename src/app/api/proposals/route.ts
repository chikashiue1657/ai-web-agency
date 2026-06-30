// POST /api/proposals - 提案書生成

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateProposal, generateProposalFallback, extractProposalData } from '@/lib/proposals'
import type { ApiResponse, ProposalInput } from '@/types'

const ProposalRequestSchema = z.object({
  store_id: z.string().uuid(),
  review_summary: z.string().optional(),
  target_customers: z.string().optional(),
  use_llm: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const parsed = ProposalRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: parsed.error.message },
        { status: 400 }
      )
    }

    const { store_id, review_summary, target_customers, use_llm } = parsed.data

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .single()

    if (storeError) throw storeError

    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('store_id', store_id)
      .limit(1)

    const input: ProposalInput = {
      store,
      lead: leads?.[0] ?? null,
      review_summary,
      target_customers,
    }

    // LLM使用 or フォールバック
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY)
    let markdown: string
    let summary: string

    if (use_llm && hasApiKey) {
      try {
        const result = await generateProposal(input)
        markdown = result.markdown
        summary = result.summary
      } catch (err) {
        console.warn('[proposals] LLM失敗、フォールバックへ:', err)
        const result = generateProposalFallback(input)
        markdown = result.markdown
        summary = result.summary
      }
    } else {
      const result = generateProposalFallback(input)
      markdown = result.markdown
      summary = result.summary
    }

    const proposalData = extractProposalData(markdown)

    const { data: proposal, error: insertError } = await supabase
      .from('proposals')
      .insert({
        store_id,
        summary,
        problems: proposalData.problems ?? [],
        opportunities: proposalData.opportunities ?? [],
        suggested_sections: proposalData.suggested_sections ?? [],
        sales_message: proposalData.sales_message ?? null,
        generated_markdown: markdown,
      })
      .select()
      .single()

    if (insertError) throw insertError

    await supabase.from('activity_logs').insert({
      store_id,
      event_type: 'proposal_generated',
      payload: { proposal_id: proposal.id, used_llm: use_llm && hasApiKey },
    })

    return NextResponse.json<ApiResponse<typeof proposal>>(
      { data: proposal, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/proposals]', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: '提案書の生成に失敗しました' },
      { status: 500 }
    )
  }
}
