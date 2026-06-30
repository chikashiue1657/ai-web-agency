// テキスト処理ユーティリティ（純関数）

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s　]+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generateSlug(name: string, area?: string | null): string {
  const base = area ? `${area}-${name}` : name
  const slug = slugify(base)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${slug || 'store'}-${suffix}`
}

// エリア正規化（沖縄中心）
export function normalizeArea(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw.replace(/[　 ]/g, ' ').trim()

  const AREA_MAP: Record<string, string> = {
    '那覇': '那覇市',
    '那覇市': '那覇市',
    '国際通り': '那覇市',
    '牧志': '那覇市',
    '浦添': '浦添市',
    '浦添市': '浦添市',
    '宜野湾': '宜野湾市',
    '宜野湾市': '宜野湾市',
    '沖縄市': '沖縄市',
    'コザ': '沖縄市',
    'うるま': 'うるま市',
    'うるま市': 'うるま市',
    '名護': '名護市',
    '名護市': '名護市',
    '恩納': '恩納村',
    '恩納村': '恩納村',
    '読谷': '読谷村',
    '読谷村': '読谷村',
    '北谷': '北谷町',
    '北谷町': '北谷町',
    'アメリカンビレッジ': '北谷町',
    '豊見城': '豊見城市',
    '豊見城市': '豊見城市',
    '糸満': '糸満市',
    '糸満市': '糸満市',
    '石垣': '石垣市',
    '石垣島': '石垣市',
    '石垣市': '石垣市',
    '宮古': '宮古島市',
    '宮古島': '宮古島市',
    '宮古島市': '宮古島市',
  }

  for (const [key, value] of Object.entries(AREA_MAP)) {
    if (text.includes(key)) return value
  }

  // 沖縄県 XX 市/町/村 パターン
  const m = text.match(/([^\s]+[市町村])/u)
  if (m) return m[1]

  return text
}

// カテゴリ正規化
export function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null

  const CATEGORY_MAP: Record<string, string> = {
    restaurant: '飲食店',
    food: '飲食店',
    cafe: 'カフェ',
    bar: 'バー',
    beauty: '美容室',
    hair: '美容室',
    salon: '美容室',
    nail: 'ネイルサロン',
    massage: 'マッサージ',
    spa: 'スパ',
    hotel: 'ホテル',
    lodging: '宿泊施設',
    ryokan: '旅館',
    guesthouse: 'ゲストハウス',
    clinic: '医院',
    hospital: '病院',
    dental: '歯科',
    shop: '小売店',
    retail: '小売店',
    supermarket: 'スーパー',
    convenience: 'コンビニ',
    gym: 'ジム',
    fitness: 'フィットネス',
    school: 'スクール',
    studio: 'スタジオ',
  }

  const lower = raw.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value
  }

  return raw
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

export function safeJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value as T
  try {
    return JSON.parse(String(value)) as T
  } catch {
    return fallback
  }
}
