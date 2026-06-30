"use client";
/**
 * 店舗詳細の生成アクション群（クライアント）。
 * - 優先度判定 / 提案書生成 / 仮サイト生成 を server action 経由で実行。
 * - useTransition で実行中表示。完了後はサーバ側 revalidate で再描画される。
 */
import { useTransition, useState } from "react";
import {
  scoreStoreAction,
  generateProposalAction,
  generateSiteAction,
} from "@/app/actions";

export function ActionsPanel({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);

  const run = (label: string, fn: () => Promise<void>) => {
    setRunning(label);
    startTransition(async () => {
      try {
        await fn();
      } finally {
        setRunning(null);
      }
    });
  };

  const btn =
    "text-sm px-3 py-1.5 rounded border border-brand-600 text-brand-600 hover:bg-brand-50 disabled:opacity-50";

  return (
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
  );
}
