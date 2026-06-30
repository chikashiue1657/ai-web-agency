// ルールベース優先度スコアリング（純関数・LLM不要）

import type { PriorityInput, PriorityRank } from '@/types'

interface RuleScore {
  total: number
  breakdown: Record<string, number>
}

// スコア配点設計
// 合計100点満点
// - SNS/HP欠如によるビジネス機会：40点
// - 既存の質（評価・口コミ）：30点
// - コンテンツ量（写真）：15点
// - エリア需要：15点

export function calcRuleScore(input: PriorityInput): RuleScore {
  const breakdown: Record<string, number> = {}

  // ── HP・SNS 欠如スコア（最大40点）──
  // HPなしは最大の機会。SNSのみ = 中程度。両方なし = 最高優先
  let digitalScore = 0
  if (!input.has_website) digitalScore += 25
  if (!input.instagram_url) digitalScore += 8
  if (!input.facebook_url) digitalScore += 7
  breakdown.digital_absence = Math.min(digitalScore, 40)

  // ── 評価スコア（最大20点）──
  // 評価が高い = 既に人気 = HP化で効果大
  const rating = input.rating ?? 0
  let ratingScore = 0
  if (rating >= 4.5) ratingScore = 20
  else if (rating >= 4.0) ratingScore = 15
  else if (rating >= 3.5) ratingScore = 10
  else if (rating >= 3.0) ratingScore = 5
  breakdown.rating = ratingScore

  // ── 口コミ数スコア（最大10点）──
  // 口コミが多い = 実績あり = 信頼できる訴求材料
  const reviews = input.review_count ?? 0
  let reviewScore = 0
  if (reviews >= 200) reviewScore = 10
  else if (reviews >= 100) reviewScore = 8
  else if (reviews >= 50) reviewScore = 6
  else if (reviews >= 20) reviewScore = 4
  else if (reviews >= 5) reviewScore = 2
  breakdown.review_count = reviewScore

  // ── 写真数スコア（最大15点）──
  // 写真が多い = ビジュアルコンテンツ豊富 = サイト映え
  const photos = input.photo_count ?? 0
  let photoScore = 0
  if (photos >= 50) photoScore = 15
  else if (photos >= 20) photoScore = 12
  else if (photos >= 10) photoScore = 8
  else if (photos >= 3) photoScore = 4
  breakdown.photo_count = photoScore

  // ── エリアスコア（最大15点）──
  // 観光エリアは外国人対応ニーズが高く優先度UP
  const area = input.area ?? ''
  let areaScore = 0
  if (['那覇市', '国際通り', '石垣市', '宮古島市', '恩納村'].some((a) => area.includes(a))) {
    areaScore = 15  // 観光中心エリア
  } else if (['北谷町', '読谷村', '糸満市', '名護市'].some((a) => area.includes(a))) {
    areaScore = 10  // 準観光エリア
  } else if (area) {
    areaScore = 5   // その他沖縄エリア
  }
  breakdown.area = areaScore

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { total, breakdown }
}

export function calcPriorityRank(score: number): PriorityRank {
  if (score >= 65) return 'A'
  if (score >= 40) return 'B'
  return 'C'
}

export function generateReasons(
  input: PriorityInput,
  breakdown: Record<string, number>
): string[] {
  const reasons: string[] = []

  if (!input.has_website) {
    reasons.push('ホームページ未整備のため、オンライン集客機会を完全に逃している')
  }
  if (!input.instagram_url && !input.facebook_url) {
    reasons.push('SNSによる情報発信がなく、潜在顧客へのリーチが限られている')
  } else if (!input.instagram_url) {
    reasons.push('Instagramがなく、ビジュアル訴求による集客機会を損失している')
  }

  const rating = input.rating ?? 0
  if (rating >= 4.0) {
    reasons.push(`Googleマップ評価${rating}と高く、ホームページ化で信頼性を強化できる`)
  }

  const reviews = input.review_count ?? 0
  if (reviews >= 50) {
    reasons.push(`口コミ${reviews}件の実績があり、レビュー訴求が即活用できる`)
  }

  if (breakdown.area >= 15) {
    reasons.push('観光エリア立地のため、外国人向け多言語対応ニーズが高い')
  } else if (breakdown.area >= 10) {
    reasons.push('準観光エリア立地のため、観光客取り込みポテンシャルがある')
  }

  if ((input.photo_count ?? 0) >= 20) {
    reasons.push('写真コンテンツが豊富で、サイト制作に活用できる素材がある')
  }

  return reasons
}

export function generateSalesAngle(input: PriorityInput): string {
  const angles: string[] = []

  if (!input.has_website) {
    angles.push('「ネット検索で見つけられない状態」から脱却')
  }
  if (!input.instagram_url && !input.facebook_url) {
    angles.push('SNS・Web双方のオンライン存在感をゼロから構築')
  }

  const area = input.area ?? ''
  const isTouristArea = ['那覇市', '石垣市', '宮古島市', '恩納村', '北谷町'].some(
    (a) => area.includes(a)
  )
  if (isTouristArea) {
    angles.push('外国人観光客・リピーター向けの多言語予約導線を整備')
  }

  const rating = input.rating ?? 0
  if (rating >= 4.0) {
    angles.push('既存の高評価をWebで可視化し、競合との差別化を明確化')
  }

  return angles.length > 0 ? angles[0] : '集客基盤のデジタル化で予約・問い合わせを自動化'
}

export function generateRiskFlags(input: PriorityInput): string[] {
  const flags: string[] = []

  const rating = input.rating ?? 0
  if (rating > 0 && rating < 3.5) {
    flags.push('Googleマップ評価が低め（3.5未満）のため、HP制作より評価改善が先決の可能性')
  }

  const reviews = input.review_count ?? 0
  if (reviews < 5) {
    flags.push('口コミ数が少なく、実績訴求が難しい段階の可能性がある')
  }

  if (!input.category) {
    flags.push('業種情報が不明のため、提案内容の精度が下がる可能性がある')
  }

  if (!input.area) {
    flags.push('エリア情報が不明のため、地域性を踏まえた提案が困難')
  }

  if ((input.photo_count ?? 0) === 0) {
    flags.push('写真コンテンツがゼロのため、サイト制作時に素材不足の課題あり')
  }

  return flags
}
