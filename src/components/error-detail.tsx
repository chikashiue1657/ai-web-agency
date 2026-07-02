"use client";
/**
 * server action失敗時の詳細表示を共通化する部品。
 * - HTTP Status / URL / Request Method / Request Body / Response Body / Network Error を
 *   ラベル付きでそのまま表示し（推測・要約しない）、「エラー詳細を表示」の折りたたみと
 *   JSON全文コピーを提供する。
 * - Neumos連携に限らず、AI診断・優先度判定・提案書生成・仮サイト生成・アウトリーチ生成・
 *   店舗取得など、外部API/LLM呼び出しを伴う全アクションのエラー表示で共有する。
 */
import { useState } from "react";
import type { NeumosErrorDetail } from "@/lib/neumos/client";

export type { NeumosErrorDetail };

export function parseErrorDetail(raw: string): NeumosErrorDetail | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NeumosErrorDetail) : null;
  } catch {
    return null;
  }
}

/** 単一のエラー詳細（表示中/コピー済みフラグ）を扱う軽量state。複数件を並行表示しないパネル向け。 */
export function useErrorDetailToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // クリップボード権限が無い環境ではコピーボタンを押しても無反応(フォールバック不要)。
    }
  }

  function reset() {
    setIsOpen(false);
    setIsCopied(false);
  }

  return { isOpen, toggle: () => setIsOpen((v) => !v), isCopied, copy, reset };
}

export function ErrorDetailPanel({
  detail,
  rawJson,
  isOpen,
  onToggle,
  isCopied,
  onCopy,
}: {
  detail: NeumosErrorDetail | null;
  rawJson: string;
  isOpen: boolean;
  onToggle: () => void;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="mt-1 flex items-center gap-2">
        <button onClick={onToggle} className="text-xs text-rose-700 hover:text-rose-900 underline">
          {isOpen ? "エラー詳細を隠す" : "エラー詳細を表示"}
        </button>
        {isOpen && (
          <button
            onClick={onCopy}
            className="text-xs px-2 py-0.5 rounded border border-rose-300 text-rose-700 hover:bg-rose-50"
          >
            {isCopied ? "コピーしました" : "JSONをコピー"}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="mt-2 space-y-2">
          {detail && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-gray-400">HTTP Status</dt>
              <dd className="text-gray-800">{detail.responseStatus ?? "(レスポンス無し)"}</dd>
              <dt className="text-gray-400">URL</dt>
              <dd className="text-gray-800 break-all">{detail.requestUrl ?? "-"}</dd>
              <dt className="text-gray-400">Request Method</dt>
              <dd className="text-gray-800">{detail.requestMethod ?? "-"}</dd>
              <dt className="text-gray-400">Request Body</dt>
              <dd className="text-gray-800 break-all whitespace-pre-wrap">
                {detail.requestBody ? JSON.stringify(detail.requestBody) : "-"}
              </dd>
              <dt className="text-gray-400">Response Body</dt>
              <dd className="text-gray-800 break-all whitespace-pre-wrap">{detail.responseBody ?? "-"}</dd>
              <dt className="text-gray-400">Network Error</dt>
              <dd className="text-gray-800 break-all whitespace-pre-wrap">{detail.networkError ?? "-"}</dd>
            </dl>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-1">JSON全文:</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-900 p-3 text-xs text-rose-200">
              {detail ? JSON.stringify(detail, null, 2) : rawJson}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
