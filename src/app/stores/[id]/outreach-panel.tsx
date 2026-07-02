"use client";
/**
 * アウトリーチ文面生成パネル（④営業メール ⑤Instagram DM ⑥電話トーク）。
 * - チャネルボタンで server action を実行し、生成文面を表示・コピーできる。
 * - 生成はルールベース＋（キーがあれば）LLM磨き。
 */
import { useState, useTransition } from "react";
import { generateOutreachAction } from "@/app/actions";
import { ErrorDetailPanel, useErrorDetailToggle, type NeumosErrorDetail } from "@/components/error-detail";
import type { OutreachChannel } from "@/lib/outreach";

const CHANNELS: Array<{ key: OutreachChannel; label: string }> = [
  { key: "email", label: "営業メール" },
  { key: "instagram_dm", label: "Instagram DM" },
  { key: "phone_script", label: "電話トーク" },
];

export function OutreachPanel({ storeId }: { storeId: string }) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState<OutreachChannel | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<NeumosErrorDetail | null>(null);
  const [copied, setCopied] = useState(false);
  const detailToggle = useErrorDetailToggle();

  function run(channel: OutreachChannel) {
    setActive(channel);
    setError(null);
    setErrorDetail(null);
    detailToggle.reset();
    setCopied(false);
    startTransition(async () => {
      const res = await generateOutreachAction(storeId, channel);
      if (res.ok) setText(res.text);
      else {
        setText("");
        setError(res.error);
        setErrorDetail(res.errorDetail);
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* クリップボード不可環境は無視 */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            onClick={() => run(c.key)}
            disabled={isPending}
            className={`text-sm px-3 py-1.5 rounded border disabled:opacity-50 ${
              active === c.key
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {isPending && active === c.key ? "生成中…" : c.label}
          </button>
        ))}
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

      {text && (
        <div>
          <div className="flex justify-end mb-1">
            <button
              onClick={copy}
              className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-800"
            >
              {copied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <textarea
            readOnly
            value={text}
            rows={12}
            className="w-full border border-gray-200 rounded p-2 text-sm font-mono bg-gray-50 whitespace-pre-wrap"
          />
        </div>
      )}
      {!text && !error && (
        <p className="text-sm text-gray-400">
          チャネルを選ぶと、店舗情報から営業文面を自動生成します。
        </p>
      )}
    </div>
  );
}
