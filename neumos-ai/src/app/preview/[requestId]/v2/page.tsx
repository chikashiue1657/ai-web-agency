import { getGenerationRecord } from "@/lib/store";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";
import { extractErrorDetail } from "@/lib/error-detail";

/**
 * v2デザインエンジンのプレビュー。既存の`/preview/[requestId]`（v1）は
 * 一切変更せず、同じ生成レコードを新しい描画コンポーネント群だけで
 * 組み直す独立ルートとして追加する。生成ロジック（brief/contents）は
 * v1と完全に同一のものを使うため、比較検証は同じrequestIdで
 * `/preview/{id}`と`/preview/{id}/v2`を見比べるだけで行える。
 *
 * 重要: BrandDirectorはここ（GETリクエスト・レンダリング時）では絶対に呼ばない。
 * BrandPlanは`generate.ts`の`performGeneration()`が生成時に一度だけ作成し
 * `record.brandPlan`として永続化済みのものを、そのままWebsiteRendererV2へ渡すだけ。
 * こうしないと、このページを開く・再読み込みするたびにOpenAI課金が発生してしまう
 * （force-dynamic・revalidate=0のためNext.jsのキャッシュにも乗らない）。
 * 過去に生成されたレコードで`brandPlan`が無い（旧レコード・カフェ以外）場合は
 * `undefined`のまま渡され、WebsiteRendererV2は従来通りBrandPlan無しで描画する。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PreviewV2Page({ params }: { params: { requestId: string } }) {
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

  return <WebsiteRendererV2 brief={record.brief} contents={record.generatedContents} brandPlan={record.brandPlan} />;
}
