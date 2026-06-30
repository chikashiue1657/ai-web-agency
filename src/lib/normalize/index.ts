// データ正規化エントリーポイント

import type { StoreInput, StoreSource, GooglePlaceRaw, ApifyPlaceRaw, CsvPlaceRaw, OpeningHours } from '@/types'
import { normalizeUrl, extractInstagramUrl, extractFacebookUrl, extractWebsiteFromSources, isWebsite } from '@/lib/utils/url'
import { normalizeArea, normalizeCategory, safeJson } from '@/lib/utils/text'

// ============================================================
// Google Places API 正規化
// ============================================================

export function normalizeGooglePlace(raw: GooglePlaceRaw): StoreInput {
  const websiteUrl = extractWebsiteFromSources([raw.website]) ?? null
  const instagramUrl = extractInstagramUrl([]) // Google Placesは直接SNS URLを持たない
  const facebookUrl = extractFacebookUrl([])

  const opening_hours: OpeningHours | null = raw.opening_hours
    ? {
        periods: raw.opening_hours.periods,
        weekday_text: raw.opening_hours.weekday_text,
      }
    : null

  const category = raw.types?.length
    ? normalizeCategory(raw.types[0]) ?? raw.types[0]
    : null

  // エリア：vicinity か formatted_address から抽出
  const area = normalizeArea(raw.vicinity ?? raw.formatted_address)

  return {
    place_id: raw.place_id ?? null,
    name: raw.name ?? '不明',
    category,
    address: raw.formatted_address ?? null,
    phone: raw.international_phone_number ?? raw.formatted_phone_number ?? null,
    opening_hours,
    rating: raw.rating ?? null,
    review_count: raw.user_ratings_total ?? 0,
    photo_count: Array.isArray(raw.photos) ? raw.photos.length : 0,
    website_url: websiteUrl,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    has_website: isWebsite(websiteUrl),
    area,
    source: 'google_places' as StoreSource,
    raw_payload: raw as Record<string, unknown>,
  }
}

// ============================================================
// Apify Google Maps Scraper 正規化
// ============================================================

export function normalizeApifyPlace(raw: ApifyPlaceRaw): StoreInput {
  const rawWebsite = raw.website ?? null
  const websiteUrl = extractWebsiteFromSources([rawWebsite])

  const socialSrcs = [
    raw.socialMedia?.instagram,
    raw.socialMedia?.facebook,
    rawWebsite,
  ]
  const instagramUrl = extractInstagramUrl(socialSrcs)
  const facebookUrl = extractFacebookUrl(socialSrcs)

  const opening_hours: OpeningHours | null = raw.openingHours?.length
    ? { weekday_text: raw.openingHours.map((h) => `${h.day}: ${h.hours}`) }
    : null

  const areaRaw = [raw.neighborhood, raw.city].filter(Boolean).join(' ')
  const area = normalizeArea(areaRaw || null)

  return {
    place_id: raw.placeId ?? null,
    name: raw.title ?? '不明',
    category: normalizeCategory(raw.categoryName) ?? raw.categoryName ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    opening_hours,
    rating: raw.totalScore ?? null,
    review_count: raw.reviewsCount ?? 0,
    photo_count: raw.imageCount ?? 0,
    website_url: websiteUrl,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    has_website: isWebsite(websiteUrl),
    area,
    source: 'apify' as StoreSource,
    raw_payload: raw as Record<string, unknown>,
  }
}

// ============================================================
// CSV 正規化
// ============================================================

export function normalizeCsvPlace(raw: CsvPlaceRaw): StoreInput {
  const websiteUrl = extractWebsiteFromSources([raw.website])
  const instagramUrl = extractInstagramUrl([raw.instagram, raw.website])
  const facebookUrl = extractFacebookUrl([raw.facebook, raw.website])

  const ratingRaw = parseFloat(raw.rating ?? '')
  const rating = isNaN(ratingRaw) ? null : ratingRaw

  const reviewCountRaw = parseInt(raw.review_count ?? '', 10)
  const reviewCount = isNaN(reviewCountRaw) ? 0 : reviewCountRaw

  return {
    place_id: null,
    name: raw.name ?? '不明',
    category: normalizeCategory(raw.category) ?? raw.category ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    opening_hours: null,
    rating,
    review_count: reviewCount,
    photo_count: 0,
    website_url: websiteUrl,
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    has_website: isWebsite(websiteUrl),
    area: normalizeArea(raw.area),
    source: 'csv' as StoreSource,
    raw_payload: raw as Record<string, unknown>,
  }
}

// ============================================================
// 汎用正規化ディスパッチャ
// ============================================================

export type RawInput =
  | { type: 'google_places'; data: GooglePlaceRaw }
  | { type: 'apify'; data: ApifyPlaceRaw }
  | { type: 'csv'; data: CsvPlaceRaw }

export function normalizeStore(input: RawInput): StoreInput {
  switch (input.type) {
    case 'google_places':
      return normalizeGooglePlace(input.data)
    case 'apify':
      return normalizeApifyPlace(input.data)
    case 'csv':
      return normalizeCsvPlace(input.data)
  }
}

// バッチ正規化
export function normalizeBatch(inputs: RawInput[]): StoreInput[] {
  return inputs.map(normalizeStore)
}

// ============================================================
// Upsert キー解決
// Supabase の upsert は place_id を優先し、
// place_id がなければ name + address で重複チェック
// ============================================================

export interface UpsertKey {
  place_id?: string
  name_address_hint?: { name: string; address: string }
}

export function resolveUpsertKey(input: StoreInput): UpsertKey {
  if (input.place_id) {
    return { place_id: input.place_id }
  }
  if (input.name && input.address) {
    return { name_address_hint: { name: input.name, address: input.address } }
  }
  return {}
}

// 欠損フィールドの補完（既存レコードとマージ）
export function mergeStoreData(
  existing: Partial<StoreInput>,
  incoming: StoreInput
): StoreInput {
  return {
    ...existing,
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, v]) => v !== null && v !== undefined)
    ),
    // raw_payload は常に最新で上書き
    raw_payload: incoming.raw_payload,
    // has_website は再計算
    has_website: incoming.has_website,
  } as StoreInput
}

// 型ガード
export function isGooglePlaceRaw(v: unknown): v is GooglePlaceRaw {
  return typeof v === 'object' && v !== null && 'place_id' in v
}

export function isApifyPlaceRaw(v: unknown): v is ApifyPlaceRaw {
  return typeof v === 'object' && v !== null && 'placeId' in v
}
