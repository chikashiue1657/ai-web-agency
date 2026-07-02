"use client";
/**
 * 店舗取得フォーム（Google Places API New）。
 * - キーワード入力（例：沖縄市 カフェ）→「店舗取得」で server action を実行し storesへ保存。
 * - server action 経由にすることで、内部APIキー(INTERNAL_API_KEY)ゲートの影響を受けない
 *   （ブラウザfetchでは x-api-key ヘッダを付けられず 401 "invalid api key" になっていた）。
 * - 保存後は router.refresh() で一覧サーバコンポーネントを再取得（自動更新）。
 * - 既存の管理画面デザイン（Tailwind, brandカラー）に合わせる。
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { searchPlacesAction } from "@/app/actions";
import { ErrorDetailPanel, useErrorDetailToggle, type NeumosErrorDetail } from "@/components/error-detail";

type Result = {
  found: number;
  inserted: number;
  updated: number;
  scored: number;
};

export function PlaceSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<NeumosErrorDetail | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const detailToggle = useErrorDetailToggle();

  const busy = loading || isPending;

  async function handleSearch() {
    const q = query.trim();
    if (!q || busy) return;
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    detailToggle.reset();
    setResult(null);
    try {
      const res = await searchPlacesAction(q);
      if (!res.ok) {
        setError(res.error);
        setErrorDetail(res.errorDetail);
        return;
      }
      setResult({
        found: res.found,
        inserted: res.inserted,
        updated: res.updated,
        scored: res.scored,
      });
      // 一覧を再取得（サーバコンポーネントの再レンダリング）
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="検索キーワード（例：沖縄市 カフェ）"
          disabled={busy}
          className="border border-gray-300 rounded px-2 py-1 text-sm w-72 disabled:bg-gray-100"
        />
        <button
          onClick={handleSearch}
          disabled={busy || !query.trim()}
          className="text-sm px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "取得中…" : "店舗取得"}
        </button>
        <span className="text-xs text-gray-400">
          Google Places API (New) で検索→保存（place_id重複は更新）→優先度を自動判定します
        </span>
      </div>

      {result && (
        <p className="mt-2 text-sm text-green-700">
          {result.found}件ヒット／新規 {result.inserted}件・更新 {result.updated}件を保存し、
          {result.scored}件の優先度を判定しました。
        </p>
      )}
      {error && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-3">
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
