// 仮デモサイト生成メインモジュール

import type { SiteGenerationInput, GeneratedSite, SiteSchema, ThemeType } from '@/types'
import { buildPageStructure, buildSiteMeta, getThemeConfig, recommendTheme } from './schema'
import { generateSlug } from '@/lib/utils/text'

// ============================================================
// サイトJSON生成（LLM不要のテンプレートベース）
// ============================================================

export function generateSiteJson(input: SiteGenerationInput): SiteSchema {
  const { store, theme_type, review_summary } = input

  const theme = theme_type ?? recommendTheme(store.category)
  const themeConfig = getThemeConfig(theme)
  const meta = buildSiteMeta(store)
  const pages = buildPageStructure(store, theme)

  // review_summaryがあればHeroセクションに反映
  if (review_summary && pages[0]?.sections[0]) {
    const hero = pages[0].sections[0]
    if (hero.type === 'hero') {
      hero.data.review_summary = review_summary
    }
  }

  return { meta, pages, theme: themeConfig }
}

// ============================================================
// GeneratedSiteエンティティ生成
// ============================================================

export function buildGeneratedSite(
  input: SiteGenerationInput,
  store_id: string
): Omit<GeneratedSite, 'id' | 'created_at' | 'updated_at'> {
  const { store, theme_type, language } = input
  const theme = (theme_type ?? recommendTheme(store.category)) as ThemeType
  const slug = generateSlug(store.name, store.area)
  const siteJson = generateSiteJson(input)

  return {
    store_id,
    slug,
    theme_type: theme,
    language: language ?? 'ja',
    generated_json: siteJson,
    published_url: null,
    status: 'draft',
  }
}

// ============================================================
// プレビューURL生成
// ============================================================

export function getPreviewUrl(slug: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${baseUrl}/preview/${slug}`
}
