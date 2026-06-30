import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { SiteSchema, SitePage, PageSection } from '@/types'

interface PageProps {
  params: Promise<{ slug: string }>
}

const THEME_STYLES: Record<string, { bg: string; primary: string; accent: string; font: string }> = {
  japanese: { bg: 'bg-stone-50', primary: 'text-stone-800', accent: 'bg-green-800 text-white', font: 'font-serif' },
  modern: { bg: 'bg-white', primary: 'text-gray-900', accent: 'bg-indigo-600 text-white', font: 'font-sans' },
  resort: { bg: 'bg-sky-50', primary: 'text-sky-900', accent: 'bg-sky-600 text-white', font: 'font-sans' },
  clean: { bg: 'bg-white', primary: 'text-gray-900', accent: 'bg-blue-500 text-white', font: 'font-sans' },
  luxury: { bg: 'bg-neutral-900', primary: 'text-neutral-100', accent: 'bg-amber-500 text-black', font: 'font-serif' },
  natural: { bg: 'bg-green-50', primary: 'text-green-900', accent: 'bg-green-600 text-white', font: 'font-sans' },
  trustworthy: { bg: 'bg-white', primary: 'text-blue-900', accent: 'bg-blue-700 text-white', font: 'font-sans' },
}

export default async function PreviewPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: site, error } = await supabase
    .from('generated_sites')
    .select('*, store:stores(*)')
    .eq('slug', slug)
    .single()

  if (error || !site) notFound()

  const schema = site.generated_json as SiteSchema | null
  if (!schema) {
    return <div className="p-8 text-center text-gray-500">サイトデータがありません</div>
  }

  const theme = THEME_STYLES[site.theme_type] ?? THEME_STYLES.modern
  const topPage = schema.pages.find((p: SitePage) => p.id === 'top')

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.font} ${theme.primary}`}>
      {/* プレビューバナー */}
      <div className="bg-amber-400 text-amber-900 text-xs text-center py-1.5 font-medium">
        ⚠ これは仮デモサイトです。実際の公開サイトではありません。
      </div>

      {/* ナビゲーション */}
      <nav className="border-b border-current border-opacity-10 px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">{schema.meta.title.split(' | ')[0]}</span>
        <div className="hidden md:flex gap-4 text-sm opacity-70">
          {schema.pages.map((p: SitePage) => (
            <a key={p.id} href={`#${p.id}`} className="hover:opacity-100">{p.title}</a>
          ))}
        </div>
      </nav>

      {/* TOPページのセクションを描画 */}
      {topPage?.sections.map((section: PageSection, i: number) => (
        <SectionRenderer key={i} section={section} theme={theme} />
      ))}

      {/* その他ページのプレビュー */}
      {schema.pages.slice(1).map((page: SitePage) => (
        <div key={page.id} id={page.id} className="border-t border-current border-opacity-10 px-6 py-10">
          <h2 className="text-xl font-bold mb-6 text-center">{page.title}</h2>
          {page.sections.map((section: PageSection, i: number) => (
            <SectionRenderer key={i} section={section} theme={theme} />
          ))}
        </div>
      ))}

      {/* フッター */}
      <footer className="border-t border-current border-opacity-10 px-6 py-8 text-center text-sm opacity-60">
        <p>{schema.meta.title.split(' | ')[0]}</p>
        <p className="mt-1 text-xs">〒 {(site.store as Record<string, unknown>)?.address as string ?? ''}</p>
        <p className="mt-4 text-xs opacity-50">このページはAI集客支援サービスによる仮デモサイトです</p>
      </footer>
    </div>
  )
}

type ThemeStyle = { bg: string; primary: string; accent: string; font: string }

function SectionRenderer({ section, theme }: { section: PageSection; theme: ThemeStyle }) {
  switch (section.type) {
    case 'hero':
      return <HeroSection data={section.data} theme={theme} />
    case 'about':
      return <AboutSection data={section.data} />
    case 'reviews':
      return <ReviewsSection data={section.data} />
    case 'access':
      return <AccessSection data={section.data} />
    case 'faq':
      return <FaqSection data={section.data} />
    case 'contact':
      return <ContactSection data={section.data} theme={theme} />
    case 'cta':
      return <CtaSection data={section.data} theme={theme} />
    default:
      return null
  }
}

function HeroSection({ data, theme }: { data: Record<string, unknown>; theme: ThemeStyle }) {
  const subheadline = data.subheadline as string | undefined
  const rating = data.rating as number | undefined
  const reviewCount = data.review_count as number | undefined
  return (
    <div className="px-6 py-20 text-center">
      <h1 className="text-3xl md:text-5xl font-bold mb-4">{data.headline as string}</h1>
      {subheadline && <p className="text-lg opacity-70 mb-2">{subheadline}</p>}
      {rating && (
        <p className="text-sm opacity-60 mb-6">
          ★{rating} （口コミ {reviewCount}件）
        </p>
      )}
      <a
        href="#contact"
        className={`inline-block px-6 py-3 rounded-full font-medium ${theme.accent} transition-opacity hover:opacity-90`}
      >
        {data.cta_text as string}
      </a>
      <div className="mt-10 h-48 bg-current opacity-5 rounded-lg max-w-2xl mx-auto flex items-center justify-center">
        <p className="opacity-40 text-sm">（写真エリア）</p>
      </div>
    </div>
  )
}

function AboutSection({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="px-6 py-10 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">{data.title as string}</h2>
      <p className="opacity-70 text-sm leading-relaxed">
        {(data.description_placeholder as string) ?? (data.description as string)}
      </p>
    </div>
  )
}

function ReviewsSection({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="px-6 py-10 bg-current bg-opacity-5">
      <h2 className="text-xl font-bold text-center mb-6">{data.title as string}</h2>
      <p className="text-center text-sm opacity-60">
        Googleマップ評価 ★{data.rating as number}（{data.review_count as number}件）
      </p>
      <p className="text-center text-xs opacity-40 mt-1">{data.note as string}</p>
    </div>
  )
}

function AccessSection({ data }: { data: Record<string, unknown> }) {
  const openingHours = data.opening_hours as { weekday_text?: string[] } | null
  const address = data.address as string | undefined
  const phone = data.phone as string | undefined
  return (
    <div className="px-6 py-10 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">{data.title as string}</h2>
      {address && <p className="text-sm mb-2">📍 {address}</p>}
      {phone && <p className="text-sm mb-2">📞 {phone}</p>}
      {openingHours?.weekday_text && (
        <div className="mt-3">
          <p className="text-xs font-medium mb-1 opacity-60">営業時間</p>
          {openingHours.weekday_text.map((t, i) => (
            <p key={i} className="text-xs opacity-70">{t}</p>
          ))}
        </div>
      )}
      <div className="mt-4 h-48 bg-current opacity-5 rounded-lg flex items-center justify-center">
        <p className="text-xs opacity-40">（地図エリア）</p>
      </div>
    </div>
  )
}

function FaqSection({ data }: { data: Record<string, unknown> }) {
  const faqs = data.faqs as Array<{ q: string; a: string }> ?? []
  return (
    <div className="px-6 py-10 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-6">{data.title as string}</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <details key={i} className="border-b border-current border-opacity-10 pb-4">
            <summary className="font-medium cursor-pointer text-sm">{faq.q}</summary>
            <p className="mt-2 text-sm opacity-70">{faq.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}

function ContactSection({ data, theme }: { data: Record<string, unknown>; theme: ThemeStyle }) {
  const phone = data.phone as string | undefined
  const note = data.note as string | undefined
  return (
    <div className="px-6 py-10 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-2 text-center">{data.title as string}</h2>
      {phone && (
        <p className="text-center text-sm opacity-70 mb-6">
          お電話: <a href={`tel:${phone}`} className="font-medium">{phone}</a>
        </p>
      )}
      <div className="space-y-3">
        {['お名前', 'お電話番号', 'メールアドレス', 'ご要望・ご質問'].map((label) => (
          <div key={label}>
            <label className="block text-xs opacity-60 mb-1">{label}</label>
            {label === 'ご要望・ご質問' ? (
              <textarea rows={3} className="w-full border border-current border-opacity-20 rounded px-3 py-2 text-sm bg-transparent" placeholder={label} />
            ) : (
              <input type="text" className="w-full border border-current border-opacity-20 rounded px-3 py-2 text-sm bg-transparent" placeholder={label} />
            )}
          </div>
        ))}
        <button className={`w-full py-3 rounded font-medium ${theme.accent}`}>
          送信する
        </button>
        {note && <p className="text-xs opacity-50 text-center">{note}</p>}
      </div>
    </div>
  )
}

function CtaSection({ data, theme }: { data: Record<string, unknown>; theme: ThemeStyle }) {
  return (
    <div className="px-6 py-12 text-center bg-current bg-opacity-5">
      <a href="#contact" className={`inline-block px-8 py-3 rounded-full font-medium ${theme.accent}`}>
        {data.text as string}
      </a>
    </div>
  )
}
