/**
 * AI集客支援MVP互換ブリッジ。
 *
 * MVP側 `src/lib/neumos/client.ts` は
 *   POST {NEUMOS_API_URL}/v1/contents  body: { generationType, brief }
 *   GET  {NEUMOS_API_URL}/v1/contents/{requestId}
 * というREST契約と、`generatedContents: GeneratedContent[]`
 * （`{ type?, title?, url?, body?, meta? }` の緩い配列）を期待する。
 *
 * Neumos AI v1のネイティブ契約（`/api/generate`）は本タスク仕様どおり
 * `generatedContents` を構造化オブジェクトとして返すため、
 * MVPの表示コンポーネント（neumos-panel.tsx の「生成物一覧」）とそのまま
 * 噛み合うように、ここで配列形式へ変換する。
 */
import type { GeneratedWebsiteContents } from "@/lib/types";

export interface LegacyGeneratedContentItem {
  type?: string;
  title?: string;
  url?: string;
  body?: string;
  meta?: Record<string, unknown>;
}

export function toLegacyGeneratedContents(
  contents: GeneratedWebsiteContents,
  previewUrl: string
): LegacyGeneratedContentItem[] {
  const items: LegacyGeneratedContentItem[] = [
    { type: "concept", title: "サイトコンセプト", body: contents.concept },
    { type: "hero", title: contents.heroTitle, body: contents.heroSubtitle, url: previewUrl },
    ...contents.sections.map((s) => ({ type: "section", title: s.heading, body: s.body })),
    { type: "cta", title: contents.cta.headline, body: contents.cta.body },
    {
      type: "seo",
      title: contents.seoTitle,
      body: contents.metaDescription,
      meta: { seoTitle: contents.seoTitle, metaDescription: contents.metaDescription },
    },
    {
      type: "faq",
      title: "よくある質問",
      body: contents.faq.map((f) => `Q. ${f.question}\nA. ${f.answer}`).join("\n\n"),
      meta: { items: contents.faq },
    },
    { type: "instagram_post", title: "Instagram投稿案", body: contents.instagramCaption },
    {
      type: "google_business_improvement",
      title: "Googleビジネスプロフィール改善案",
      body: contents.googleBusinessImprovement.join("\n"),
      meta: { items: contents.googleBusinessImprovement },
    },
  ];
  return items;
}
