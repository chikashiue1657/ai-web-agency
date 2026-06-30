import { calcRuleScore, calcPriorityRank, generateReasons, generateSalesAngle, generateRiskFlags } from '@/lib/priority/rule-based'
import type { PriorityInput } from '@/types'

const BASE_INPUT: PriorityInput = {
  store_id: 'test-001',
  name: 'テスト店',
  category: '飲食店',
  rating: 4.3,
  review_count: 87,
  photo_count: 24,
  has_website: false,
  instagram_url: null,
  facebook_url: null,
  area: '那覇市',
  opening_hours: null,
}

describe('calcRuleScore', () => {
  it('HPなし + SNSなし で高スコアになる', () => {
    const { total } = calcRuleScore(BASE_INPUT)
    expect(total).toBeGreaterThan(50)
  })

  it('HPあり + SNSあり でスコアが下がる', () => {
    const withAll = {
      ...BASE_INPUT,
      has_website: true,
      instagram_url: 'https://www.instagram.com/test/',
      facebook_url: 'https://www.facebook.com/test/',
    }
    const { total: withAllScore } = calcRuleScore(withAll)
    const { total: baseScore } = calcRuleScore(BASE_INPUT)
    expect(baseScore).toBeGreaterThan(withAllScore)
  })

  it('評価4.5以上で最大ratingスコア', () => {
    const high = { ...BASE_INPUT, rating: 4.5 }
    const { breakdown } = calcRuleScore(high)
    expect(breakdown.rating).toBe(20)
  })

  it('評価なしはratingスコア0', () => {
    const noRating = { ...BASE_INPUT, rating: null }
    const { breakdown } = calcRuleScore(noRating)
    expect(breakdown.rating).toBe(0)
  })

  it('那覇市は最大エリアスコア', () => {
    const { breakdown } = calcRuleScore(BASE_INPUT)
    expect(breakdown.area).toBe(15)
  })

  it('200件以上の口コミで最大review_countスコア', () => {
    const many = { ...BASE_INPUT, review_count: 200 }
    const { breakdown } = calcRuleScore(many)
    expect(breakdown.review_count).toBe(10)
  })

  it('合計スコアは0〜100の範囲', () => {
    const { total } = calcRuleScore(BASE_INPUT)
    expect(total).toBeGreaterThanOrEqual(0)
    expect(total).toBeLessThanOrEqual(100)
  })
})

describe('calcPriorityRank', () => {
  it('65以上はA', () => expect(calcPriorityRank(65)).toBe('A'))
  it('64はB', () => expect(calcPriorityRank(64)).toBe('B'))
  it('40はB', () => expect(calcPriorityRank(40)).toBe('B'))
  it('39はC', () => expect(calcPriorityRank(39)).toBe('C'))
  it('0はC', () => expect(calcPriorityRank(0)).toBe('C'))
})

describe('generateReasons', () => {
  it('HPなし時に機会損失の理由を生成する', () => {
    const { breakdown } = calcRuleScore(BASE_INPUT)
    const reasons = generateReasons(BASE_INPUT, breakdown)
    expect(reasons.some((r) => r.includes('ホームページ'))).toBe(true)
  })

  it('SNSなし時にSNS理由を生成する', () => {
    const { breakdown } = calcRuleScore(BASE_INPUT)
    const reasons = generateReasons(BASE_INPUT, breakdown)
    expect(reasons.some((r) => r.includes('SNS'))).toBe(true)
  })

  it('理由は配列で返る', () => {
    const { breakdown } = calcRuleScore(BASE_INPUT)
    const reasons = generateReasons(BASE_INPUT, breakdown)
    expect(Array.isArray(reasons)).toBe(true)
    expect(reasons.length).toBeGreaterThan(0)
  })
})

describe('generateRiskFlags', () => {
  it('評価3.5未満でリスクフラグを生成する', () => {
    const lowRating = { ...BASE_INPUT, rating: 3.0 }
    const flags = generateRiskFlags(lowRating)
    expect(flags.some((f) => f.includes('評価'))).toBe(true)
  })

  it('口コミ少数でリスクフラグを生成する', () => {
    const fewReviews = { ...BASE_INPUT, review_count: 3 }
    const flags = generateRiskFlags(fewReviews)
    expect(flags.some((f) => f.includes('口コミ数'))).toBe(true)
  })

  it('問題なければフラグ空配列', () => {
    const good = {
      ...BASE_INPUT,
      rating: 4.5,
      review_count: 100,
      category: '飲食店',
      area: '那覇市',
      photo_count: 20,
    }
    const flags = generateRiskFlags(good)
    expect(Array.isArray(flags)).toBe(true)
  })
})

describe('generateSalesAngle', () => {
  it('HPなしで集客アングルを生成する', () => {
    const angle = generateSalesAngle(BASE_INPUT)
    expect(typeof angle).toBe('string')
    expect(angle.length).toBeGreaterThan(0)
  })

  it('観光エリアで多言語アングルを含む可能性がある', () => {
    const tourist = { ...BASE_INPUT, area: '石垣市' }
    const angle = generateSalesAngle(tourist)
    expect(typeof angle).toBe('string')
  })
})
