"use client";

import { useState } from "react";
import { saveStoreMenuAction } from "@/app/actions";
import type { RealMenuItem } from "@/lib/types";

const emptyItem = (): RealMenuItem => ({ name: "", price: "", description: "" });

export function MenuEditor({ storeId, initialItems }: { storeId: string; initialItems: RealMenuItem[] }) {
  const [items, setItems] = useState<RealMenuItem[]>(initialItems.length ? initialItems : [emptyItem()]);
  const action = saveStoreMenuAction.bind(null, storeId);
  const update = (index: number, key: keyof RealMenuItem, value: string) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="menuItems" value={JSON.stringify(items)} />
      <p className="text-sm text-gray-600">
        確認できた商品名と価格だけを入力してください。保存後に生成したv2サイトへ反映されます。
      </p>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="grid gap-2 rounded border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[1.2fr_.55fr_1.8fr_auto]">
            <input aria-label={`商品名 ${index + 1}`} value={item.name} onChange={(e) => update(index, "name", e.target.value)} placeholder="商品名（必須）" maxLength={80} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
            <input aria-label={`価格 ${index + 1}`} value={item.price ?? ""} onChange={(e) => update(index, "price", e.target.value)} placeholder="例：¥650" maxLength={40} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
            <input aria-label={`説明 ${index + 1}`} value={item.description ?? ""} onChange={(e) => update(index, "description", e.target.value)} placeholder="短い説明（任意）" maxLength={240} className="rounded border border-gray-300 px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="rounded px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">削除</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={items.length >= 20} onClick={() => setItems((current) => [...current, emptyItem()])} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">＋ 商品を追加</button>
        <button type="submit" className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700">実メニューを保存</button>
      </div>
    </form>
  );
}
