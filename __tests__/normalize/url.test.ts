import {
  normalizeUrl,
  extractInstagramUrl,
  extractFacebookUrl,
  isWebsite,
  extractWebsiteFromSources,
  getDomain,
} from '@/lib/utils/url'

describe('normalizeUrl', () => {
  it('正常なURLをそのまま返す', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
  })

  it('httpなしのURLにhttpsを付与する', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
  })

  it('nullをnullで返す', () => {
    expect(normalizeUrl(null)).toBeNull()
  })

  it('空文字をnullで返す', () => {
    expect(normalizeUrl('')).toBeNull()
  })

  it('不正なURLをnullで返す', () => {
    expect(normalizeUrl('not a url at all!!!')).toBeNull()
  })
})

describe('extractInstagramUrl', () => {
  it('Instagram URLを抽出する', () => {
    const result = extractInstagramUrl(['https://www.instagram.com/testuser/'])
    expect(result).toBe('https://www.instagram.com/testuser/')
  })

  it('URLが含まれる文字列から抽出する', () => {
    const result = extractInstagramUrl(['フォロー: https://instagram.com/myshop 営業中'])
    expect(result).toBe('https://www.instagram.com/myshop/')
  })

  it('複数ソースの最初のマッチを返す', () => {
    const result = extractInstagramUrl([null, 'https://instagram.com/first', 'https://instagram.com/second'])
    expect(result).toBe('https://www.instagram.com/first/')
  })

  it('InstagramがなければnullをかえすS', () => {
    expect(extractInstagramUrl(['https://example.com', null])).toBeNull()
  })
})

describe('extractFacebookUrl', () => {
  it('Facebook URLを抽出する', () => {
    const result = extractFacebookUrl(['https://www.facebook.com/mypage'])
    expect(result).toBe('https://www.facebook.com/mypage/')
  })

  it('fb.comも抽出する', () => {
    const result = extractFacebookUrl(['https://fb.com/mypage'])
    expect(result).toBe('https://www.facebook.com/mypage/')
  })
})

describe('isWebsite', () => {
  it('通常のウェブサイトはtrue', () => {
    expect(isWebsite('https://example.com')).toBe(true)
    expect(isWebsite('https://my-restaurant.co.jp')).toBe(true)
  })

  it('FacebookはfalseF', () => {
    expect(isWebsite('https://www.facebook.com/mypage')).toBe(false)
  })

  it('InstagramはfalseI', () => {
    expect(isWebsite('https://www.instagram.com/myshop')).toBe(false)
  })

  it('食べログはfalse', () => {
    expect(isWebsite('https://tabelog.com/okinawa/A4701/A470101/47001234/')).toBe(false)
  })

  it('nullはfalse', () => {
    expect(isWebsite(null)).toBe(false)
  })
})

describe('extractWebsiteFromSources', () => {
  it('SNSを除いて実サイトURLを返す', () => {
    const result = extractWebsiteFromSources([
      'https://www.instagram.com/myshop',
      'https://my-shop.com',
    ])
    expect(result).toBe('https://my-shop.com/')
  })

  it('すべてSNSの場合はnullを返す', () => {
    const result = extractWebsiteFromSources([
      'https://www.instagram.com/myshop',
      'https://www.facebook.com/mypage',
    ])
    expect(result).toBeNull()
  })
})

describe('getDomain', () => {
  it('www.を除いたドメインを返す', () => {
    expect(getDomain('https://www.example.com/path')).toBe('example.com')
  })

  it('nullはnullを返す', () => {
    expect(getDomain(null)).toBeNull()
  })
})
