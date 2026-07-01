import { GENERATION_TYPE_LABELS } from "@/lib/catalog";
import { isGenerationTypeImplemented, type GenerationType } from "@/lib/types";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Neumos AI v1</h1>
        <p className="text-gray-600 mt-1">
          店舗情報・AI診断・営業提案内容から、店舗向けのWeb集客コンテンツを自動生成するAIエンジンです。
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-semibold text-gray-800">API</h2>
        <p className="text-sm text-gray-500 mt-1">
          <code className="bg-gray-100 px-1.5 py-0.5 rounded">POST /api/generate</code>{" "}
          に <code>{"{ generationType, brief }"}</code> を送信すると、生成結果のJSONと
          プレビューURLが返ります。
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="font-semibold text-gray-800">生成種別（generationType）</h2>
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {Object.entries(GENERATION_TYPE_LABELS).map(([type, label]) => {
            const enabled = isGenerationTypeImplemented(type as GenerationType);
            return (
              <li key={type} className="py-1.5 flex items-center justify-between">
                <span>
                  {label} <span className="text-gray-400 text-xs">({type})</span>
                </span>
                <span
                  className={
                    enabled
                      ? "text-xs px-2 py-0.5 rounded bg-brand-100 text-brand-700"
                      : "text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400"
                  }
                >
                  {enabled ? "実装済み" : "拡張予定"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
