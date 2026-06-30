import {
  normalizeGooglePlace,
  normalizeApifyPlace,
  normalizeCsvPlace,
} from '@/lib/normalize'
import type { GooglePlaceRaw, ApifyPlaceRaw, CsvPlaceRaw } from '@/types'

describe('normalizeGooglePlace', () => {
  const base: GooglePlaceRaw = {
    place_id: 'ChIJtest123',
    name: 'テスト食堂',
    formatted_address: '沖縄県那覇市牧志1-1-1',
    rating: 4.3,
    user_ratings_total: 87,
    photos: [{}, {}, {}],
    types: ['restaurant', 'food'],
    website: 'https://example.com',
  }

  it('place_idを引き継ぐ', () => {
    const result = normalizeGooglePlace(base)
    expect(result.place_id).toBe('ChIJtest123')
  })

  it('ratingとreview_countを変換する', () => {
    const result = normalizeGooglePlace(base)
    expect(result.rating).toBe(4.3)
    expect(result.review_count).toBe(87)
  })

  it('photo_countを枚数で返す', () => {
    const result = normalizeGooglePlace(base)
    expect(result.photo_count).toBe(3)
  })

  it('websiteがある場合has_websiteがtrue', () => {
    const result = normalizeGooglePlace(base)
    expect(result.has_website).toBe(true)
    expect(result.website_url).toBe('https://example.com/')
  })

  it('SNSのURLはwebsiteとして扱わない', () => {
    const result = normalizeGooglePlace({ ...base, website: 'https://www.facebook.com/testpage' })
    expect(result.has_website).toBe(false)
    expect(result.website_url).toBeNull()
  })

  it('websiteがない場合has_websiteがfalse', () => {
    const result = normalizeGooglePlace({ ...base, website: undefined })
    expect(result.has_website).toBe(false)
  })

  it('欠損フィールドがあってもエラーにならない', () => {
    expect(() => normalizeGooglePlace({})).not.toThrow()
  })

  it('sourceがgoogle_placesになる', () => {
    const result = normalizeGooglePlace(base)
    expect(result.source).toBe('google_places')
  })
})

describe('normalizeApifyPlace', () => {
  const base: ApifyPlaceRaw = {
    placeId: 'apify-001',
    title: '沖縄そば 花笠',
    address: '沖縄県那覇市国際通り1-2-3',
    phone: '098-000-0001',
    totalScore: 4.5,
    reviewsCount: 120,
    imageCount: 15,
    categoryName: 'restaurant',
    neighborhood: '牧志',
    city: '那覇市',
    socialMedia: {
      instagram: 'https://www.instagram.com/hanagasa/',
    },
  }

  it('Instagramを抽出する', () => {
    const result = normalizeApifyPlace(base)
    expect(result.instagram_url).toBe('https://www.instagram.com/hanagasa/')
  })

  it('エリアを正規化する', () => {
    const result = normalizeApifyPlace(base)
    expect(result.area).toBe('那覇市')
  })

  it('カテゴリを正規化する', () => {
    const result = normalizeApifyPlace(base)
    expect(result.category).toBe('飲食店')
  })

  it('欠損フィールドがあってもエラーにならない', () => {
    expect(() => normalizeApifyPlace({})).not.toThrow()
  })
})

describe('normalizeCsvPlace', () => {
  const base: CsvPlaceRaw = {
    name: 'カフェ琉球',
    category: 'cafe',
    address: '沖縄県石垣市美崎町5-1',
    phone: '0980-111-2222',
    rating: '4.1',
    review_count: '32',
    website: 'https://cafe-ryukyu.example.com',
    instagram: 'https://www.instagram.com/cafe_ryukyu/',
    area: '石垣市',
  }

  it('ratingを数値に変換する', () => {
    const result = normalizeCsvPlace(base)
    expect(result.rating).toBe(4.1)
  })

  it('review_countを数値に変換する', () => {
    const result = normalizeCsvPlace(base)
    expect(result.review_count).toBe(32)
  })

  it('Instagramを抽出する', () => {
    const result = normalizeCsvPlace(base)
    expect(result.instagram_url).toBe('https://www.instagram.com/cafe_ryukyu/')
  })

  it('has_websiteを正しく判定する', () => {
    const result = normalizeCsvPlace(base)
    expect(result.has_website).toBe(true)
  })

  it('ratingが不正な場合nullを返す', () => {
    const result = normalizeCsvPlace({ ...base, rating: 'invalid' })
    expect(result.rating).toBeNull()
  })

  it('カテゴリを正規化する', () => {
    const result = normalizeCsvPlace(base)
    expect(result.category).toBe('カフェ')
  })
})
