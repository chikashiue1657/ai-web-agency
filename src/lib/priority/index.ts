// 優先度判定メインモジュール
// フェーズ1: ルールベース → フェーズ2: LLM補正（オプション）

import type { PriorityInput, PriorityResult } from '@/types'
import {
  calcRuleScore,
  calcPriorityRank,
  generateReasons,
  generateSalesAngle,
  generateRiskFlags,
} from './rule-based'

// LLM補正設定
const LLM_CORRECTION_ENABLED = process.env.OPENAI_API_KEY !== undefined

// ============================================================
// メイン判定関数（純粋関数として実装）
// ============================================================

export async function evaluatePriority(
  input: PriorityInput,
  options: { useLlm?: boolean } = {}
): Promise<PriorityResult> {
  // フェーズ1: ルールベーススコアリング
  const { total: ruleScore, breakdown } = calcRuleScore(input)

  const reasons = generateReasons(input, breakdown)
  const salesAngle = generateSalesAngle(input)
  const riskFlags = generateRiskFlags(input)

  // フェーズ2: LLM補正（オプション）
  let llmCorrection: number | null = null
  let finalScore = ruleScore

  const useLlm = options.useLlm ?? LLM_CORRECTION_ENABLED
  if (useLlm) {
    try {
      const correction = await getLlmCorrection(input, ruleScore, reasons)
      llmCorrection = correction.delta
      finalScore = Math.max(0, Math.min(100, ruleScore + correction.delta))

      // LLM由来の理由を追記
      if (correction.additional_reasons.length > 0) {
        reasons.push(...correction.additional_reasons)
      }
    } catch (err) {
      console.warn('[priority] LLM補正をスキップ:', err)
    }
  }

  const priorityRank = calcPriorityRank(finalScore)

  return {
    priority_rank: priorityRank,
    score: finalScore,
    reasons,
    sales_angle: salesAngle,
    risk_flags: riskFlags,
    rule_score: ruleScore,
    llm_correction: llmCorrection,
  }
}

// バッチ実行（並列制限付き）
export async function evaluatePriorityBatch(
  inputs: PriorityInput[],
  options: { useLlm?: boolean; concurrency?: number } = {}
): Promise<Map<string, PriorityResult>> {
  const concurrency = options.concurrency ?? 3
  const results = new Map<string, PriorityResult>()

  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((input) => evaluatePriority(input, options))
    )
    batch.forEach((input, idx) => {
      results.set(input.store_id, batchResults[idx])
    })
  }

  return results
}

// ============================================================
// LLM補正（Claude API）
// ============================================================

interface LlmCorrection {
  delta: number
  additional_reasons: string[]
}

async function getLlmCorrection(
  input: PriorityInput,
  ruleScore: number,
  existingReasons: string[]
): Promise<LlmCorrection> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const prompt = buildCorrectionPrompt(input, ruleScore, existingReasons)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseCorrectionResponse(text)
}

function buildCorrectionPrompt(
  input: PriorityInput,
  ruleScore: number,
  existingReasons: string[]
): string {
  return `あなたは沖縄エリアの店舗向けAI集客支援サービスの営業優先度アドバイザーです。

以下の店舗情報とルールベーススコアを確認し、追加の補正が必要かどうか判断してください。

## 店舗情報
- 店名: ${input.name}
- 業種: ${input.category ?? '不明'}
- エリア: ${input.area ?? '不明'}
- 評価: ${input.rating ?? '不明'}
- 口コミ数: ${input.review_count}
- 写真数: ${input.photo_count}
- HP有無: ${input.has_website ? 'あり' : 'なし'}
- Instagram: ${input.instagram_url ? 'あり' : 'なし'}
- Facebook: ${input.facebook_url ? 'あり' : 'なし'}
${input.description ? `- 店舗概要: ${input.description}` : ''}
${input.review_summary ? `- 口コミ要約: ${input.review_summary}` : ''}

## ルールベーススコア: ${ruleScore}/100
## 現在の判定理由: ${existingReasons.join('、')}

## 指示
ルールベーススコアへの補正値（-15〜+15の整数）と、追加の判定理由があればJSON形式で返してください。
補正が不要な場合は delta: 0 としてください。
実在しない情報は作らないでください。不明な点は「〜の可能性がある」と表現してください。

## 出力形式（JSON のみ、説明不要）
{"delta": 数値, "additional_reasons": ["理由1", "理由2"]}
`
}

function parseCorrectionResponse(text: string): LlmCorrection {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return { delta: 0, additional_reasons: [] }
    const parsed = JSON.parse(match[0])
    return {
      delta: typeof parsed.delta === 'number' ? Math.max(-15, Math.min(15, parsed.delta)) : 0,
      additional_reasons: Array.isArray(parsed.additional_reasons)
        ? parsed.additional_reasons
        : [],
    }
  } catch {
    return { delta: 0, additional_reasons: [] }
  }
}
