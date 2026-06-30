// URL抽出・判定ユーティリティ（純関数）

const INSTAGRAM_PATTERNS = [
  /instagram\.com\/([^/?#\s]+)/i,
  /instagr\.am\/([^/?#\s]+)/i,
]

const FACEBOOK_PATTERNS = [
  /facebook\.com\/([^/?#\s]+)/i,
  /fb\.com\/([^/?#\s]+)/i,
  /fb\.me\/([^/?#\s]+)/i,
]

// SNS URLは「ホームページ」として扱わないドメインリスト
const NON_WEBSITE_DOMAINS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'youtube.com',
  'google.com',
  'maps.google.com',
  'tabelog.com',
  'hotpepper.jp',
  'gurunavi.com',
  'jalan.net',
  'tripadvisor.jp',
]

export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    return u.href
  } catch {
    return null
  }
}

export function extractInstagramUrl(
  sources: Array<string | null | undefined>
): string | null {
  for (const src of sources) {
    if (!src) continue
    for (const pattern of INSTAGRAM_PATTERNS) {
      const m = src.match(pattern)
      if (m) return `https://www.instagram.com/${m[1]}/`
    }
  }
  return null
}

export function extractFacebookUrl(
  sources: Array<string | null | undefined>
): string | null {
  for (const src of sources) {
    if (!src) continue
    for (const pattern of FACEBOOK_PATTERNS) {
      const m = src.match(pattern)
      if (m) return `https://www.facebook.com/${m[1]}/`
    }
  }
  return null
}

export function isWebsite(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    const hostname = u.hostname.replace(/^www\./, '')
    return !NON_WEBSITE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
  } catch {
    return false
  }
}

export function extractWebsiteFromSources(
  sources: Array<string | null | undefined>
): string | null {
  for (const src of sources) {
    const normalized = normalizeUrl(src)
    if (normalized && isWebsite(normalized)) {
      return normalized
    }
  }
  return null
}

export function getDomain(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
