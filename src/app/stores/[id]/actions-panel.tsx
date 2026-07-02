"use client";
/**
 * 店舗詳細の生成アクション群（クライアント）。
 * - 優先度判定 / 提案書生成 / 仮サイト生成 を server action 経由で実行。
 * - useTransition で実行中表示。完了後はサーバ側 revalidate で再描画される。
 * - 失敗時はエラー詳細（HTTP Status/URL/Request Method/Request Body/Response Body/
 *   Network Error）を「エラー詳細を表示」で確認できる。
 */
import { useTransition, useState } from "react";
import {
  scoreStoreAction,
  generateProposalAction,
  generateSiteAction,
  type SimpleActionResult,
} from "@/app/actions";
import { ErrorDetailPanel, useErrorDetailToggle, type NeumosErrorDetail } from "@/components/error-detail";

export function ActionsPanel({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<NeumosErrorDetail | null>(null);
  const detailToggle = useErrorDetailToggle();

  const run = (label: string, fn: () => Promise<SimpleActionResult>) => {
    setRunning(label);
    setError(null);
    setErrorDetail(null);
    detailToggle.reset();
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          setErrorDetail(res.errorDetail);
        }
      } finally {
        setRunning(null);
      }
    });
  };

  const btn =
    "text-sm px-3 py-1.5 rounded border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className={btn}
          disabled={isPending}
          onClick={() => run("score", () => scoreStoreAction(storeId))}
        >
          {running === "score" ? "判定中…" : "優先度を判定"}
        </button>
        <button
          className={btn}
          disabled={isPending}
          onClick={() => run("proposal", () => generateProposalAction(storeId))}
        >
          {running === "proposal" ? "生成中…" : "提案書を生成"}
        </button>
        <button
          className={btn}
          disabled={isPending}
          onClick={() => run("site", () => generateSiteAction(storeId))}
        >
          {running === "site" ? "生成中…" : "仮サイトを生成"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">エラー: {error}</p>
          <ErrorDetailPanel
            detail={errorDetail}
            rawJson={errorDetail ? JSON.stringify(errorDetail) : error}
            isOpen={detailToggle.isOpen}
            onToggle={detailToggle.toggle}
            isCopied={detailToggle.isCopied}
            onCopy={() => detailToggle.copy(errorDetail ? JSON.stringify(errorDetail, null, 2) : error)}
          />
        </div>
      )}
    </div>
  );
}
