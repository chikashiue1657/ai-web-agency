"use client";
/**
 * ノイモスAI連携パネル（店舗のWeb集客コンテンツ生成）。
 * - まず「この店舗のホームページをAIで作成」を実装。
 * - 同じBrief(契約)から将来 LP/ブログ/Instagram/GBP/FAQ/コピー/SEO も生成できる設計。
 *   未対応の種別は「近日対応」チップで提示（generationType を渡すだけで有効化可能）。
 * - 営業支援 → 受注 → 生成 → 公開 のフローを可視化。
 * - 押下でブリーフを組み立て、ノイモスAIへ投入（未接続なら下書き保存）。
 *   未接続時は、実際に渡されるブリーフJSONを表示して受け渡し内容を確認できる。
 */
import { useState, useTransition } from "react";
import { requestContentGenerationAction } from "@/app/actions";
import type { ContentGenerationRequest, GenerationType } from "@/lib/types";
import { GENERATION_TYPES, GENERATION_TYPE_LABEL } from "@/lib/neumos/catalog";

const FLOW = ["営業支援", "受注", "生成", "公開"] as const;

export function NeumosPanel({
  storeId,
  isWon,
  latestRequest,
}: {
  storeId: string;
  isWon: boolean;
  latestRequest: ContentGenerationRequest | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [runningType, setRunningType] = useState<GenerationType | null>(null);
  const [result, setResult] = useState<{
    connected: boolean;
    request: ContentGenerationRequest;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  const current = result?.request ?? latestRequest;

  // フローの現在地: 公開>生成>受注>営業支援
  const stageIndex = current?.published_url
    ? 3
    : current
      ? 2
      : isWon
        ? 1
        : 0;

  function run(type: GenerationType) {
    setError(null);
    setRunningType(type);
    startTransition(async () => {
      const res = await requestContentGenerationAction(storeId, type);
      if (res.ok) setResult({ connected: res.connected, request: res.request });
      else setError(res.error);
      setRunningType(null);
    });
  }

  const website = GENERATION_TYPES.find((t) => t.type === "website")!;
  const comingSoon = GENERATION_TYPES.filter((t) => !t.enabled);

  return (
    <div className="space-y-4">
      {/* フロー可視化 */}
      <div className="flex items-center gap-1 text-xs">
        {FLOW.map((label, i) => (
          <div key={label} className="flex items-center">
            <span
              className={`px-2 py-1 rounded ${
                i <= stageIndex
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {label}
            </span>
            {i < FLOW.length - 1 && <span className="mx-1 text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {/* 主実装: ホームページ生成 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => run("website")}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {isPending && runningType === "website"
            ? "依頼中…"
            : "この店舗のホームページをAIで作成"}
        </button>
        {!isWon && (
          <span className="text-xs text-amber-600">
            ※本番生成は受注（成約）後を推奨。未受注でもブリーフの確認は可能です。
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400">{website.description}</p>

      {/* 将来対応の生成種別（同じBriefから拡張予定） */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          同じ店舗ブリーフから生成予定のコンテンツ（近日対応）
        </div>
        <div className="flex flex-wrap gap-1.5">
          {comingSoon.map((t) => (
            <span
              key={t.type}
              title={t.description}
              className="text-xs px-2 py-1 rounded border border-dashed border-gray-300 text-gray-400"
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">エラー: {error}</p>}

      {/* 直近リクエストの状態 */}
      {current && (
        <div className="text-sm border border-gray-100 rounded p-3 bg-gray-50 space-y-1">
          <div>
            種別: <span className="font-medium">{GENERATION_TYPE_LABEL[current.generation_type] ?? current.generation_type}</span>
            {" ／ "}連携先: <span className="font-medium">{current.provider}</span>
            {" ／ "}状態: <span className="font-medium">{statusLabel(current.status)}</span>
          </div>
          {result && !result.connected && (
            <p className="text-xs text-amber-700">
              ノイモスAIは未接続のため「下書き」として保存しました。接続後に本番生成へ移行できます。
            </p>
          )}
          {current.preview_url && (
            <a href={current.preview_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              プレビューを開く ↗
            </a>
          )}
          {current.published_url && (
            <a href={current.published_url} target="_blank" rel="noreferrer" className="text-green-700 hover:underline">
              公開サイトを開く ↗
            </a>
          )}

          {current.brief && (
            <div className="pt-1">
              <button
                onClick={() => setShowBrief((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                {showBrief ? "ブリーフを隠す" : "ノイモスAIへ渡すブリーフを表示"}
              </button>
              {showBrief && (
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto max-h-80">
                  {JSON.stringify(current.brief, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {!current && !error && (
        <p className="text-sm text-gray-400">
          受注後、ここからノイモスAIへ本番ホームページの生成を依頼できます。
        </p>
      )}
    </div>
  );
}

function statusLabel(s: ContentGenerationRequest["status"]): string {
  const map: Record<ContentGenerationRequest["status"], string> = {
    draft: "下書き（未接続）",
    requested: "依頼済み",
    queued: "生成待ち",
    generating: "生成中",
    preview: "プレビュー可",
    published: "公開済み",
    failed: "失敗",
  };
  return map[s] ?? s;
}
