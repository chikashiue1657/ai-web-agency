import { getGenerationRecord } from "@/lib/store";
import { WebsiteRenderer } from "@/components/website/WebsiteRenderer";

/**
 * 生成結果のプレビュー画面。
 * `/api/generate` が返した requestId でこのページへアクセスすると、
 * Website Renderer が組み立てた実際のホームページ（Next.jsコンポーネント・Tailwind・レスポンシブ対応）
 * をそのまま確認できる。このページ自体がそのまま公開可能な状態になっている。
 */
export default function PreviewPage({ params }: { params: { requestId: string } }) {
  const record = getGenerationRecord(params.requestId);

  if (!record) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-bold text-gray-800">プレビューが見つかりません</h1>
        <p className="mt-2 text-sm text-gray-500">
          requestId: <code>{params.requestId}</code>{" "}
          は存在しないか、サーバー再起動によりインメモリの生成結果が失われた可能性があります。
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
