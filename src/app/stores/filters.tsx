"use client";
/**
 * 店舗一覧のフィルタフォーム（クライアント）。
 * - 入力をURLクエリに反映してサーバ側で絞り込む（SSRと相性が良い）。
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const CATEGORIES = [
  ["", "全業種"],
  ["restaurant", "飲食店"],
  ["cafe", "カフェ"],
  ["izakaya", "居酒屋"],
  ["beauty", "美容"],
  ["clinic", "医療"],
  ["hotel", "宿泊"],
  ["retail", "小売"],
  ["other", "その他"],
] as const;

export function StoreFilters({ areas }: { areas: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`/stores?${next.toString()}`);
    },
    [params, router]
  );

  const val = (k: string) => params.get(k) ?? "";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap gap-2 items-center">
      <input
        type="text"
        placeholder="店名・住所で検索"
        defaultValue={val("q")}
        onKeyDown={(e) => {
          if (e.key === "Enter") update("q", (e.target as HTMLInputElement).value);
        }}
        className="border border-gray-300 rounded px-2 py-1 text-sm w-48"
      />
      <select
        value={val("category")}
        onChange={(e) => update("category", e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
      >
        {CATEGORIES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <select
        value={val("area")}
        onChange={(e) => update("area", e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
      >
        <option value="">全エリア</option>
        {areas.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <select
        value={val("priority")}
        onChange={(e) => update("priority", e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
      >
        <option value="">全優先度</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
      <select
        value={val("has_website")}
        onChange={(e) => update("has_website", e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
      >
        <option value="">HP有無（全て）</option>
        <option value="false">HPなし</option>
        <option value="true">HPあり</option>
      </select>
      <select
        value={val("sort")}
        onChange={(e) => update("sort", e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm"
      >
        <option value="score_desc">スコア高い順</option>
        <option value="score_asc">スコア低い順</option>
        <option value="name_asc">店名順</option>
        <option value="created_desc">取込新しい順</option>
      </select>
      <button
        onClick={() => router.push("/stores")}
        className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1"
      >
        クリア
      </button>
    </div>
  );
}
