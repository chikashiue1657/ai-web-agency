"use client";
/**
 * 営業管理: ステータス・ファネル（未対応→DM送信→電話→商談→成約/失注）。
 * - 現在ステータスをハイライトし、ワンクリックで遷移できる。
 */
import { useTransition } from "react";
import { setStatusAction } from "@/app/actions";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABEL, LEAD_STATUS_STYLE } from "@/lib/status";
import type { LeadStatus } from "@/lib/types";

export function StatusFunnel({
  storeId,
  current,
  disabled,
}: {
  storeId: string;
  current: LeadStatus | null;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function set(status: LeadStatus) {
    if (disabled || isPending) return;
    startTransition(() => setStatusAction(storeId, status));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {LEAD_STATUS_ORDER.map((s) => {
          const isCurrent = current === s;
          return (
            <button
              key={s}
              onClick={() => set(s)}
              disabled={disabled || isPending}
              className={`text-sm px-3 py-1.5 rounded border transition disabled:opacity-50 ${
                isCurrent
                  ? `${LEAD_STATUS_STYLE[s]} border-transparent font-bold ring-2 ring-offset-1 ring-gray-300`
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {LEAD_STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>
      {disabled && (
        <p className="text-xs text-gray-400 mt-2">
          先に「優先度を判定」を実行するとステータスを管理できます。
        </p>
      )}
    </div>
  );
}
