"use client";
/**
 * ノイモスAI連携パネル（店舗のWeb集客コンテンツ生成）。
 * - 「この店舗のホームページをAIで作成」で Neumos API へ生成投入。
 * - 生成状況(Queued/Generating/Preview/Published/Failed)を表示・更新（ポーリング）。
 * - Preview/Published のURLへ遷移。生成物を表示。失敗時は再生成。生成履歴一覧。
 * - Neumos未接続時は下書き保存し、渡す NeumosBrief のJSONを確認できる。
 * - 表示はサーバから渡る requests を正とし、アクション後は revalidate で最新化。
 */
import { useState, useTransition } from "react";
import {
  requestContentGenerationAction,
  refreshContentStatusAction,
} from "@/app/actions";
import type { ContentGenerationRequest, ContentGenStatus, GenerationType } from "@/lib/types";
import { GENERATION_TYPES, GENERATION_TYPE_LABEL } from "@/lib/neumos/catalog";

const FLOW = ["営業支援", "受注", "生成", "公開"] as const;

const STATUS_LABEL: Record<ContentGenStatus, string> = {
  draft: "下書き（未接続）",
  requested: "Requested",
  queued: "Queued",
  generating: "Generating",
  preview: "Preview",
  published: "Published",
  failed: "Failed",
};

const STATUS_STYLE: Record<ContentGenStatus, string> = {
  draft: "bg-gray-100 text-gray-600",
  requested: "bg-blue-100 text-blue-700",
  queued: "bg-blue-100 text-blue-700",
  generating: "bg-amber-100 text-amber-700",
  preview: "bg-indigo-100 text-indigo-700",
  published: "bg-green-100 text-green-700",
  failed: "bg-rose-100 text-rose-700",
};

function StatusBadge({ status }: { status: ContentGenStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function NeumosPanel({
  storeId,
  isWon,
  requests,
}: {
  storeId: string;
  isWon: boolean;
  requests: ContentGenerationRequest[];
}) {
  const [isPending, startTransition] = useTransition();
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBriefId, setShowBriefId] = useState<string | null>(null);

  const latest = requests[0] ?? null;

  // フローの現在地: 公開>生成>受注>営業支援
  const stageIndex = latest?.status === "published"
    ? 3
    : latest
      ? 2
      : isWon
        ? 1
        : 0;

  function generate(type: GenerationType, key: string) {
    setError(null);
    setRunningKey(key);
    startTransition(async () => {
      const res = await requestContentGenerationAction(storeId, type);
      if (!res.ok) setError(res.error);
      setRunningKey(null);
    });
  }

  function refresh(reqId: string) {
    setError(null);
    setRunningKey("refresh:" + reqId);
    startTransition(async () => {
      const res = await refreshContentStatusAction(storeId, reqId);
      if (!res.ok) setError(res.error);
      setRunningKey(null);
    });
  }

  const comingSoon = GENERATION_TYPES.filter((t) => !t.enabled);
  const website = GENERATION_TYPES.find((t) => t.type === "website")!;

  return (
    <div className="space-y-4">
      {/* フロー可視化 */}
      <div className="flex items-center gap-1 text-xs">
        {FLOW.map((label, i) => (
          <div key={label} className="flex items-center">
            <span className={`px-2 py-1 rounded ${i <= stageIndex ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {label}
            </span>
            {i < FLOW.length - 1 && <span className="mx-1 text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {/* 主実装: ホームページ生成 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => generate("website", "gen:website")}
          disabled={isPending}
          className="text-sm px-4 py-2 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 font-medium"
        >
          {isPending && runningKey === "gen:website" ? "依頼中…" : "この店舗のホームページをAIで作成"}
        </button>
        {!isWon && (
          <span className="text-xs text-amber-600">※本番生成は受注（成約）後を推奨。</span>
        )}
      </div>
      <p className="text-xs text-gray-400">{website.description}</p>

      {/* 将来対応の生成種別 */}
      <div>
        <div className="text-xs text-gray-500 mb-1">同じ店舗ブリーフから生成予定（近日対応）</div>
        <div className="flex flex-wrap gap-1.5">
          {comingSoon.map((t) => (
            <span key={t.type} title={t.description} className="text-xs px-2 py-1 rounded border border-dashed border-gray-300 text-gray-400">
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">エラー: {error}</p>}

      {/* 最新リクエストの詳細 */}
      {latest && (
        <div className="text-sm border border-gray-100 rounded p-3 bg-gray-50 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={latest.status} />
            <span className="text-gray-600">
              {GENERATION_TYPE_LABEL[latest.generation_type] ?? latest.generation_type}
            </span>
            <span className="text-xs text-gray-400">／ {latest.provider}</span>
            {latest.external_id && (
              <span className="text-xs text-gray-400">／ requestId: {latest.external_id}</span>
            )}
          </div>

          {latest.status === "draft" && (
            <p className="text-xs text-amber-700">
              ノイモスAI未接続のため「下書き」保存。NEUMOS_API_URL/KEY 設定で本番生成が有効化されます。
            </p>
          )}
          {latest.error && <p className="text-xs text-rose-700">理由: {latest.error}</p>}

          {/* アクション: 更新 / プレビュー / 公開 / 再生成 */}
          <div className="flex flex-wrap gap-2">
            {latest.external_id && (
              <button
                onClick={() => refresh(latest.id)}
                disabled={isPending}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {runningKey === "refresh:" + latest.id ? "更新中…" : "生成状況を更新"}
              </button>
            )}
            {latest.preview_url && (
              <a href={latest.preview_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700">
                Preview を確認 ↗
              </a>
            )}
            {latest.published_url && (
              <a href={latest.published_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700">
                公開サイトを開く ↗
              </a>
            )}
            {latest.status === "failed" && (
              <button
                onClick={() => generate(latest.generation_type, "gen:retry")}
                disabled={isPending}
                className="text-xs px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {runningKey === "gen:retry" ? "再生成中…" : "再生成する"}
              </button>
            )}
          </div>

          {/* 生成物 */}
          {latest.generated_contents && latest.generated_contents.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">生成物</div>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded bg-white">
                {latest.generated_contents.map((c, i) => (
                  <li key={i} className="px-2 py-1.5 flex items-center justify-between gap-2">
                    <span>
                      {c.title ?? c.type ?? `コンテンツ${i + 1}`}
                      {c.type && <span className="text-xs text-gray-400 ml-1">({c.type})</span>}
                    </span>
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline shrink-0">
                        開く ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* NeumosBrief JSON */}
          {latest.brief && (
            <div>
              <button
                onClick={() => setShowBriefId((v) => (v === latest.id ? null : latest.id))}
                className="text-xs text-gray-500 hover:text-gray-800 underline"
              >
                {showBriefId === latest.id ? "NeumosBriefを隠す" : "ノイモスAIへ渡す NeumosBrief を表示"}
              </button>
              {showBriefId === latest.id && (
                <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto max-h-80">
                  {JSON.stringify(latest.brief, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* 生成履歴 */}
      {requests.length > 1 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">生成履歴（{requests.length}件）</div>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded">
            {requests.map((r) => (
              <li key={r.id} className="px-2 py-1.5 flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-gray-600">
                    {GENERATION_TYPE_LABEL[r.generation_type] ?? r.generation_type}
                  </span>
                  <span className="text-xs text-gray-400">{r.created_at.replace("T", " ").slice(0, 16)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.preview_url && (
                    <a href={r.preview_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline">Preview</a>
                  )}
                  {r.published_url && (
                    <a href={r.published_url} target="_blank" rel="noreferrer" className="text-xs text-green-700 hover:underline">公開</a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!latest && !error && (
        <p className="text-sm text-gray-400">
          受注後、ここからノイモスAIへホームページの生成を依頼できます。
        </p>
      )}
    </div>
  );
}
