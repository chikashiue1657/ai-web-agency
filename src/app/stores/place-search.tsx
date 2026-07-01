"use client";
/**
 * 店舗取得フォーム（Google Places API New）。
 * - キーワード入力（例：沖縄市 カフェ）→「店舗取得」でAPIを呼び、storesへ保存。
 * - 保存後は router.refresh() で一覧サーバコンポーネントを再取得（自動更新）。
 * - 既存の管理画面デザイン（Tailwind, brandカラー）に合わせる。
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Result = {
  found: number;
  inserted: number;
  updated: number;
};

export function PlaceSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const busy = loading || isPending;

  async function handleSearch() {
    const q = query.trim();
    if (!q || busy) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.message ?? "取得に失敗しました");
        return;
      }
      setResult({
        found: json.data.found,
        inserted: json.data.inserted,
        updated: json.data.updated,
      });
      // 一覧を再取得（サーバコンポーネントの再レンダリング）
      startTransition(() => router.refresh());
    } catch {
      setError("ネットワークエラーが発生しました");
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
          Google Places API (New) で検索し、重複(place_id)を除いて保存します
        </span>
      </div>

      {result && (
        <p className="mt-2 text-sm text-green-700">
          {result.found}件ヒット／新規 {result.inserted}件・更新 {result.updated}件を保存しました。
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">エラー: {error}</p>}
    </div>
  );
}
