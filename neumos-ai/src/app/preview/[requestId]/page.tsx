import { getGenerationRecord } from "@/lib/store";
import { WebsiteRenderer } from "@/components/website/WebsiteRenderer";
import { extractErrorDetail } from "@/lib/error-detail";

/**
 * Next.js App RouterはGETの動的ルートを既定でキャッシュしうる（Full Route Cache /
 * fetchのData Cache）。生成直後にSupabaseへ書き込まれたばかりの行を必ず最新で
 * 読むため、このセグメントは常に動的レンダリング・no-storeにする
 * （さもないと、書き込み前に一度でも同じrequestIdへアクセスされた場合、
 * 「見つかりません」の結果がキャッシュされ続けてしまう）。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * 生成結果のプレビュー画面。
 * `/api/generate` が返した requestId でこのページへアクセスすると、
 * Website Renderer が組み立てた実際のホームページ（Next.jsコンポーネント・Tailwind・レスポンシブ対応）
 * をそのまま確認できる。このページ自体がそのまま公開可能な状態になっている。
 */
export default async function PreviewPage({ params }: { params: { requestId: string } }) {
  let record;
  try {
    record = await getGenerationRecord(params.requestId);
  } catch (err) {
    const detail = extractErrorDetail(err);
    console.error("[neumos-ai] preview page lookup failed", detail);
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

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 sm:text-sm">
        Neumos AI プレビュー（requestId: {record.requestId} ／ 生成方式: {record.method}） ―{" "}
        <a href={`/api/preview/${record.requestId}/raw`} target="_blank" rel="noreferrer" className="underline">
          単体HTMLを書き出す ↗
        </a>
      </div>
      <WebsiteRenderer brief={record.brief} contents={record.generatedContents} />
    </>
  );
}
