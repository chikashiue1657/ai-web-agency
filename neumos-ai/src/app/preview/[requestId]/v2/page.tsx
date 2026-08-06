import type { Metadata } from "next";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import { extractErrorDetail } from "@/lib/error-detail";
import { buildCafeStructuredData, serializeStructuredData } from "@/lib/seo-v2";
import { getGenerationRecord } from "@/lib/store";
import { filterArtifacts } from "@/lib/editorial/filter";
import { compressArtifacts } from "@/lib/editorial/compress";
import { arrangeArtifacts } from "@/lib/editorial/arrange";
import { toRenderables } from "@/lib/editorial/renderable";
import { assignPresentation } from "@/lib/editorial/presentation";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";

/**
 * Phase 6限定接続: `?editorial=1`のときだけ編集パイプライン
 * (Observation→Artifacts→Filter→Compress→Arrange→Renderable→Presentation)
 * を実行し、その結果を`WebsiteRendererV2`の`editorialPreview`propへ渡す。
 * クエリパラメータを付けない通常アクセスでは一切実行されず、既存の描画に
 * 影響しない(既存分岐は変更しない)。
 */
async function buildEditorialPreview(brief: StoreBrief, contents: GeneratedWebsiteContents, requestId: string) {
  const { editorial, utility } = filterArtifacts(brief, contents);
  const { artifacts: compressed } = await compressArtifacts(editorial);
  const arranged = arrangeArtifacts(compressed, undefined, requestId);
  const presented = assignPresentation(toRenderables(arranged));
  return { presented, utility };
}

/**
 * v2デザインエンジンのプレビュー。既存の`/preview/[requestId]`（v1）は
 * 一切変更せず、同じ生成レコードを新しい描画コンポーネント群だけで
 * 組み直す独立ルートとして追加する。
 *
 * 重要: Brand Directorはここ（GETリクエスト・レンダリング時）では呼ばない。
 * BrandPlanは生成時に保存された`record.brandPlan`を読むだけにする。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function v2Url(previewUrl: string): string {
  const normalized = previewUrl.replace(/\/$/, "");
  return normalized.endsWith("/v2") ? normalized : `${normalized}/v2`;
}

export async function generateMetadata({ params }: { params: { requestId: string } }): Promise<Metadata> {
  const record = await getGenerationRecord(params.requestId).catch(() => undefined);
  if (!record) return { title: "プレビューが見つかりません | Neumos AI" };

  const image = record.brief.realData?.photoUrls?.[0];
  const pageUrl = v2Url(record.previewUrl);
  return {
    title: record.generatedContents.seoTitle,
    description: record.generatedContents.metaDescription,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      title: record.generatedContents.seoTitle,
      description: record.generatedContents.metaDescription,
      url: pageUrl,
      images: image ? [{ url: image, alt: `${record.brief.storeName}の写真` }] : undefined,
    },
  };
}

export default async function PreviewV2Page({
  params,
  searchParams,
}: {
  params: { requestId: string };
  searchParams?: { editorial?: string };
}) {
  let record;
  try {
    record = await getGenerationRecord(params.requestId);
  } catch (err) {
    const detail = extractErrorDetail(err);
    console.error("[neumos-ai] preview v2 page lookup failed", detail);
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-bold text-red-700">プレビューの取得に失敗しました</h1>
        <p className="mt-2 text-sm text-gray-500">requestId: <code>{params.requestId}</code></p>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-900 p-3 text-xs text-rose-200">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </main>
    );
  }

  if (!record) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-bold text-gray-800">プレビューが見つかりません</h1>
        <p className="mt-2 text-sm text-gray-500">
          requestId: <code>{params.requestId}</code>{" "}
          は存在しないか、生成結果がまだ保存されていない可能性があります。
          もう一度 <code>POST /api/generate</code> を実行してください。
        </p>
      </main>
    );
  }

  const structuredData = buildCafeStructuredData(record.brief, record.generatedContents, v2Url(record.previewUrl));

  const editorialPreview =
    searchParams?.editorial === "1"
      ? await buildEditorialPreview(record.brief, record.generatedContents, params.requestId)
      : undefined;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
      <WebsiteRendererV2
        brief={record.brief}
        contents={record.generatedContents}
        brandPlan={record.brandPlan}
        editorialPreview={editorialPreview}
      />
    </>
  );
}
