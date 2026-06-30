/**
 * 仮デモサイトのプレビュー（営業提示用）。
 * - generated_json(SiteDocument) を描画。モバイルファースト・テーマカラー反映。
 * - ?p=<pageSlug> でページ切替。SEO metadataも生成。
 * - これは「仮サイト」であることを明示するバーを上部に出す（誤公開防止）。
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import type { SiteDocument, SitePage, SiteSection } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadDoc(slug: string): Promise<SiteDocument | null> {
  const site = await getRepo().getSiteBySlug(slug);
  return (site?.generated_json as SiteDocument) ?? null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { p?: string };
}): Promise<Metadata> {
  const doc = await loadDoc(params.slug);
  if (!doc) return { title: "プレビュー" };
  const page = pickPage(doc, searchParams.p);
  return { title: page.seo.title, description: page.seo.description };
}

function pickPage(doc: SiteDocument, slug?: string): SitePage {
  return doc.pages.find((p) => p.slug === (slug ?? "")) ?? doc.pages[0];
}

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { p?: string };
}) {
  const doc = await loadDoc(params.slug);
  if (!doc) notFound();
  const page = pickPage(doc, searchParams.p);

  return (
    <div className="min-h-screen" style={{ background: "#fff" }}>
      {/* 仮サイト明示バー（誤公開・誤認防止） */}
      <div className="bg-amber-500 text-white text-xs text-center py-1 px-2">
        これは営業提案用の自動生成「仮デモサイト」です。掲載内容には仮説が含まれます。
      </div>

      {/* ヘッダ（テーマカラー） */}
      <header style={{ background: doc.brandColor }} className="text-white">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="text-lg font-bold">{doc.storeName}</div>
          <nav className="flex flex-wrap gap-3 mt-2 text-sm opacity-90">
            {doc.pages.map((p) => (
              <Link
                key={p.slug || "top"}
                href={`/preview/${params.slug}${p.slug ? `?p=${p.slug}` : ""}`}
                className={`hover:underline ${p.slug === page.slug ? "font-bold underline" : ""}`}
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {page.sections.map((section, i) => (
          <SectionView key={i} section={section} brandColor={doc.brandColor} usedFallback={doc.usedPhotoFallback} />
        ))}
      </main>

      <footer className="border-t border-gray-200 mt-8 py-6 text-center text-xs text-gray-400">
        {doc.storeName} ／ テーマ: {doc.themeType} ／ 自動生成プレビュー
      </footer>
    </div>
  );
}

function SectionView({
  section,
  brandColor,
  usedFallback,
}: {
  section: SiteSection;
  brandColor: string;
  usedFallback: boolean;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-2" style={{ color: brandColor }}>
        {section.heading}
        {section.isHypothesis && (
          <span className="ml-2 align-middle text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
            仮説
          </span>
        )}
      </h2>

      {/* hero/gallery で写真不足時はカラープレースホルダ */}
      {(section.type === "hero" || section.type === "gallery") && usedFallback && (
        <div
          className="w-full h-40 rounded-lg mb-3 flex items-center justify-center text-white/80 text-sm"
          style={{ background: brandColor }}
        >
          （店舗写真は準備中）
        </div>
      )}

      {section.body && (
        <p className="text-sm text-gray-700 whitespace-pre-line">{section.body}</p>
      )}

      {section.items && section.items.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 border border-gray-100 rounded">
          {section.items.map((it, i) => (
            <li key={i} className="px-3 py-2 flex justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{it.title}</div>
                {it.description && <div className="text-xs text-gray-500">{it.description}</div>}
              </div>
              {it.meta && <div className="text-xs text-gray-400 shrink-0">{it.meta}</div>}
            </li>
          ))}
        </ul>
      )}

      {section.faqs && section.faqs.length > 0 && (
        <dl className="mt-2 space-y-2">
          {section.faqs.map((f, i) => (
            <div key={i} className="border border-gray-100 rounded p-2">
              <dt className="text-sm font-medium">Q. {f.q}</dt>
              <dd className="text-sm text-gray-600 mt-0.5">A. {f.a}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
