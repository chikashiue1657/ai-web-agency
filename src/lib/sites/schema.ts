// 仮デモサイト生成 - JSONスキーマ定義と業種別テーマ

import type { ThemeType, SiteTheme, SiteSchema, SiteMeta, SitePage, PageSection, SectionType } from '@/types'
import type { Store } from '@/types'

// ============================================================
// 業種別テーママッピング
// ============================================================

const CATEGORY_THEME_MAP: Record<string, ThemeType[]> = {
  '飲食店': ['japanese', 'modern', 'resort'],
  'カフェ': ['natural', 'modern'],
  'バー': ['modern', 'luxury'],
  '美容室': ['clean', 'luxury', 'natural'],
  'ネイルサロン': ['luxury', 'natural'],
  'マッサージ': ['natural', 'clean'],
  'スパ': ['resort', 'luxury'],
  'ホテル': ['resort', 'luxury'],
  '宿泊施設': ['resort', 'japanese'],
  '旅館': ['japanese', 'resort'],
  'ゲストハウス': ['natural', 'modern'],
  '医院': ['trustworthy', 'clean'],
  '病院': ['trustworthy', 'clean'],
  '歯科': ['clean', 'trustworthy'],
  '小売店': ['modern', 'natural'],
  'ジム': ['modern', 'clean'],
}

export function recommendTheme(category: string | null): ThemeType {
  if (!category) return 'modern'
  const themes = CATEGORY_THEME_MAP[category]
  if (themes?.length) return themes[0]
  return 'modern'
}

const THEME_CONFIG: Record<ThemeType, SiteTheme> = {
  japanese: {
    type: 'japanese',
    primary_color: '#2D4A3E',   // 深緑
    accent_color: '#C9A84C',    // 金
    font_family: '"Noto Serif JP", serif',
  },
  modern: {
    type: 'modern',
    primary_color: '#1A1A2E',   // ネイビー
    accent_color: '#FF6B35',    // オレンジ
    font_family: '"Noto Sans JP", sans-serif',
  },
  resort: {
    type: 'resort',
    primary_color: '#006994',   // 海ブルー
    accent_color: '#F4C430',    // サンシャイン
    font_family: '"Noto Sans JP", sans-serif',
  },
  clean: {
    type: 'clean',
    primary_color: '#FFFFFF',
    accent_color: '#4A90E2',    // 信頼ブルー
    font_family: '"Noto Sans JP", sans-serif',
  },
  luxury: {
    type: 'luxury',
    primary_color: '#1C1C1C',   // チャコール
    accent_color: '#C9A84C',    // ゴールド
    font_family: '"Noto Serif JP", serif',
  },
  natural: {
    type: 'natural',
    primary_color: '#4A7856',   // グリーン
    accent_color: '#F2A65A',    // テラコッタ
    font_family: '"Noto Sans JP", sans-serif',
  },
  trustworthy: {
    type: 'trustworthy',
    primary_color: '#1E3A5F',   // 濃紺
    accent_color: '#2ECC71',    // 安心グリーン
    font_family: '"Noto Sans JP", sans-serif',
  },
}

export function getThemeConfig(type: ThemeType): SiteTheme {
  return THEME_CONFIG[type] ?? THEME_CONFIG.modern
}

// ============================================================
// ページ構成生成（業種別）
// ============================================================

export function buildPageStructure(store: Store, theme: ThemeType): SitePage[] {
  const category = store.category ?? ''
  const isFoodService = ['飲食店', 'カフェ', 'バー'].includes(category)
  const isBeauty = ['美容室', 'ネイルサロン', 'マッサージ', 'スパ'].includes(category)
  const isAccommodation = ['ホテル', '宿泊施設', '旅館', 'ゲストハウス'].includes(category)
  const isMedical = ['医院', '病院', '歯科'].includes(category)

  const pages: SitePage[] = []

  // TOP ページ
  pages.push({
    id: 'top',
    slug: '/',
    title: 'ホーム',
    sections: buildTopSections(store, { isFoodService, isBeauty, isAccommodation, isMedical }),
  })

  // 店舗紹介ページ
  pages.push({
    id: 'about',
    slug: '/about',
    title: '店舗紹介',
    sections: [
      buildAboutSection(store),
      buildGallerySection(store),
    ],
  })

  // メニュー/サービスページ
  pages.push({
    id: 'menu',
    slug: '/menu',
    title: isFoodService ? 'メニュー' : isAccommodation ? '客室・プラン' : isMedical ? '診療内容' : 'サービス・料金',
    sections: [
      buildMenuSection(store, { isFoodService, isBeauty, isAccommodation, isMedical }),
    ],
  })

  // アクセスページ
  pages.push({
    id: 'access',
    slug: '/access',
    title: 'アクセス',
    sections: [buildAccessSection(store)],
  })

  // FAQページ
  pages.push({
    id: 'faq',
    slug: '/faq',
    title: 'よくある質問',
    sections: [buildFaqSection(store, { isFoodService, isBeauty, isMedical })],
  })

  // 問い合わせページ
  pages.push({
    id: 'contact',
    slug: '/contact',
    title: 'お問い合わせ・予約',
    sections: [buildContactSection(store)],
  })

  return pages
}

type CategoryFlags = {
  isFoodService: boolean
  isBeauty: boolean
  isAccommodation: boolean
  isMedical: boolean
}

function buildTopSections(store: Store, flags: CategoryFlags): PageSection[] {
  const sections: PageSection[] = [
    {
      type: 'hero',
      data: {
        headline: store.name,
        subheadline: store.category ? `${store.area ?? '沖縄'}の${store.category}` : store.area ?? '',
        cta_text: flags.isMedical ? '診療予約はこちら' : '予約・お問い合わせ',
        cta_link: '/contact',
        image_placeholder: true,
        rating: store.rating,
        review_count: store.review_count,
      },
    },
    {
      type: 'about',
      data: {
        title: `${store.name}について`,
        description: `${store.area ?? '沖縄'}の${store.category ?? '店舗'}です。Googleマップで${store.review_count}件の口コミをいただいています。`,
        is_placeholder: true,
      },
    },
  ]

  if (store.rating && store.rating >= 4.0 && store.review_count >= 10) {
    sections.push({
      type: 'reviews',
      data: {
        title: 'お客様の声',
        rating: store.rating,
        review_count: store.review_count,
        note: 'Googleマップの評価より',
        placeholder_reviews: generatePlaceholderReviews(store),
      },
    })
  }

  sections.push({ type: 'cta', data: { text: '無料相談・予約はこちら', link: '/contact' } })

  return sections
}

function buildAboutSection(store: Store): PageSection {
  return {
    type: 'about',
    data: {
      title: '店舗紹介',
      name: store.name,
      category: store.category,
      area: store.area,
      phone: store.phone,
      opening_hours: store.opening_hours,
      is_placeholder: true,
      description_placeholder: `${store.name}のこだわりや想いをここに記載します。（オーナー様よりヒアリング予定）`,
    },
  }
}

function buildGallerySection(store: Store): PageSection {
  return {
    type: 'gallery',
    data: {
      title: 'ギャラリー',
      photo_count: store.photo_count,
      placeholder_count: Math.min(store.photo_count, 6),
      note: store.photo_count > 0
        ? `Googleマップより${store.photo_count}枚の写真があります`
        : '写真は撮影後に掲載予定です',
    },
  }
}

function buildMenuSection(store: Store, flags: CategoryFlags): PageSection {
  let title = 'サービス・料金'
  if (flags.isFoodService) title = 'メニュー'
  else if (flags.isAccommodation) title = '客室・プラン'
  else if (flags.isMedical) title = '診療内容'

  return {
    type: 'menu',
    data: {
      title,
      is_placeholder: true,
      note: 'メニュー・料金はオーナー様よりヒアリング後に掲載します',
      category_hint: store.category,
    },
  }
}

function buildAccessSection(store: Store): PageSection {
  return {
    type: 'access',
    data: {
      title: 'アクセス',
      address: store.address,
      phone: store.phone,
      opening_hours: store.opening_hours,
      google_maps_query: store.name + (store.address ? ` ${store.address}` : ''),
    },
  }
}

function buildFaqSection(store: Store, flags: Pick<CategoryFlags, 'isFoodService' | 'isBeauty' | 'isMedical'>): PageSection {
  const faqs = getDefaultFaqs(store.category, flags)
  return {
    type: 'faq',
    data: {
      title: 'よくある質問',
      faqs,
    },
  }
}

function buildContactSection(store: Store): PageSection {
  return {
    type: 'contact',
    data: {
      title: 'お問い合わせ・予約',
      phone: store.phone,
      form_fields: ['name', 'phone', 'email', 'message', 'date'],
      note: '※お問い合わせには1営業日以内にご返答いたします',
    },
  }
}

function getDefaultFaqs(category: string | null, flags: Pick<CategoryFlags, 'isFoodService' | 'isBeauty' | 'isMedical'>) {
  if (flags.isMedical) {
    return [
      { q: '予約は必要ですか？', a: 'お電話またはウェブフォームからご予約いただけます。当日でも空きがあれば対応可能です。（要確認）' },
      { q: '保険は使えますか？', a: '各種保険に対応しています。詳細はお電話でご確認ください。（要確認）' },
      { q: '駐車場はありますか？', a: '駐車場についてはお問い合わせください。（要確認）' },
    ]
  }
  if (flags.isBeauty) {
    return [
      { q: '予約は必要ですか？', a: '基本的に予約制です。当日のご予約もお電話にて承っています。（要確認）' },
      { q: '子供連れでも大丈夫ですか？', a: 'ご来店前にお電話でご相談ください。（要確認）' },
      { q: 'カード払いはできますか？', a: 'お支払い方法についてはお問い合わせください。（要確認）' },
    ]
  }
  if (flags.isFoodService) {
    return [
      { q: '予約はできますか？', a: 'お電話またはウェブフォームからご予約いただけます。（要確認）' },
      { q: 'テイクアウトはできますか？', a: 'テイクアウトについてはお問い合わせください。（要確認）' },
      { q: 'アレルギー対応はできますか？', a: 'アレルギーをお持ちの方はご来店前にご相談ください。（要確認）' },
    ]
  }
  return [
    { q: 'ご予約・お問い合わせ方法を教えてください', a: 'お電話またはウェブフォームよりお気軽にどうぞ。' },
    { q: '営業時間を教えてください', a: '営業時間はアクセスページをご確認ください。' },
  ]
}

function generatePlaceholderReviews(store: Store): Array<{ text: string; rating: number }> {
  // 実際の口コミは取得できないため、評価のみを示すプレースホルダー
  return [
    {
      text: `Googleマップにて${store.review_count}件の口コミをいただいています。実際の口コミはGoogleマップよりご確認ください。`,
      rating: store.rating ?? 4.0,
    },
  ]
}

// ============================================================
// SEO メタデータ生成
// ============================================================

export function buildSiteMeta(store: Store): SiteMeta {
  const area = store.area ?? '沖縄'
  const category = store.category ?? ''
  const keywords = [
    store.name,
    area,
    category,
    `${area} ${category}`,
    `${area} ${category} おすすめ`,
    '予約',
  ].filter(Boolean)

  return {
    title: `${store.name} | ${area}の${category}`,
    description: `${area}の${category}「${store.name}」です。${store.rating ? `Googleマップ評価${store.rating}（口コミ${store.review_count}件）。` : ''}お気軽にお問い合わせください。`,
    keywords,
    lang: 'ja',
  }
}
