import { getGenerationRecord } from "@/lib/store";

/**
 * 生成結果のプレビュー画面。
 * `/api/generate` が返した requestId でこのページへアクセスすると、
 * 生成されたホームページ本文を実際のページとして確認できる。
 */
export default function PreviewPage({ params }: { params: { requestId: string } }) {
  const record = getGenerationRecord(params.requestId);

  if (!record) {
    return (
      <main className="max-w-2xl mx-auto p-8">
        <h1 className="text-xl font-bold text-gray-800">プレビューが見つかりません</h1>
        <p className="mt-2 text-gray-500 text-sm">
          requestId: <code>{params.requestId}</code>{" "}
          は存在しないか、サーバー再起動によりインメモリの生成結果が失われた可能性があります。
          もう一度 <code>POST /api/generate</code> を実行してください。
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{record.brief.storeName} — プレビュー</h1>
          <p className="text-xs text-gray-500">
            requestId: {record.requestId} ／ 生成方式: {record.method} ／ 生成日時: {record.createdAt}
          </p>
        </div>
        <a
          href={`/api/preview/${record.requestId}/raw`}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700"
        >
          単体HTMLを新しいタブで開く ↗
        </a>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: "80vh" }}>
        <iframe
          title="Neumos AI preview"
          src={`/api/preview/${record.requestId}/raw`}
          className="w-full h-full"
        />
      </div>
    </main>
  );
}
