"use client";

import Image from "next/image";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveStoreMenuAction,
  uploadStoreMenuPhotoAction,
} from "@/app/actions";
import type { RealMenuItem } from "@/lib/types";

const MENU_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

function prepareInitialItems(items: RealMenuItem[]): RealMenuItem[] {
  if (!items.length) return [{ id: "new-0", name: "", price: "", description: "" }];
  return items.map((item, index) => ({ ...item, id: item.id ?? `legacy-${index}` }));
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="rounded bg-brand-600 px-4 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50">
      {pending ? "保存中…" : "メニュー全体を保存"}
    </button>
  );
}

export function MenuEditor({ storeId, initialItems }: { storeId: string; initialItems: RealMenuItem[] }) {
  const [items, setItems] = useState<RealMenuItem[]>(() => prepareInitialItems(initialItems));
  const [message, setMessage] = useState("");
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const action = saveStoreMenuAction.bind(null, storeId);
  const isUploading = busyIndex !== null;

  const update = (index: number, key: "name" | "price" | "description", value: string) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const move = (index: number, direction: -1 | 1) => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const upload = async (index: number, file?: File) => {
    if (!file) return;
    setBusyIndex(index);
    setMessage("");
    const formData = new FormData();
    formData.set("photo", file);
    try {
      const result = await uploadStoreMenuPhotoAction(storeId, formData);
      if (result.ok) {
        setItems((current) => current.map((item, i) => i === index
          ? { ...item, imageUrl: result.imageUrl, imagePath: result.imagePath }
          : item));
        setMessage("写真を保存しました。最後にメニュー全体を保存してください。");
      } else {
        setMessage(result.error);
      }
    } finally {
      setBusyIndex(null);
    }
  };

  const removePhoto = (index: number) => {
    setItems((current) => current.map((item, i) => i === index
      ? { ...item, imageUrl: undefined, imagePath: undefined }
      : item));
    setMessage("写真はメニュー全体を保存した時点で削除されます。");
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
    setMessage("商品はメニュー全体を保存した時点で削除されます。");
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="menuItems" value={JSON.stringify(items)} />
      <p className="text-sm text-gray-600">
        実際の商品名・価格・説明・写真を登録できます。写真はJPEG・PNG・WebP、1枚5MBまでです。
      </p>
      {message && <p role="status" className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</p>}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[140px_1fr_auto]">
            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded bg-gray-200">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={`${item.name || `商品${index + 1}`}の写真`} fill sizes="140px" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-500">写真なし</div>
                )}
              </div>
              <label className="mt-2 block cursor-pointer rounded border border-gray-300 bg-white px-2 py-1.5 text-center text-xs hover:bg-gray-50">
                {busyIndex === index ? "処理中…" : item.imageUrl ? "写真を変更" : "写真を追加"}
                <input
                  type="file"
                  accept={MENU_PHOTO_ACCEPT}
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => upload(index, event.target.files?.[0])}
                />
              </label>
              {item.imageUrl && (
                <button type="button" disabled={isUploading} onClick={() => removePhoto(index)} className="mt-1 w-full px-2 py-1 text-xs text-red-700 hover:underline">
                  写真だけ削除
                </button>
              )}
            </div>
            <div className="grid content-start gap-2">
              <input aria-label={`商品名 ${index + 1}`} value={item.name} onChange={(e) => update(index, "name", e.target.value)} placeholder="商品名（必須）" maxLength={80} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input aria-label={`価格 ${index + 1}`} value={item.price ?? ""} onChange={(e) => update(index, "price", e.target.value)} placeholder="価格（例：650円）" maxLength={40} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <textarea aria-label={`説明 ${index + 1}`} value={item.description ?? ""} onChange={(e) => update(index, "description", e.target.value)} placeholder="商品の短い説明（任意）" maxLength={240} rows={3} className="rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-1 sm:flex-col">
              <button type="button" disabled={index === 0 || isUploading} onClick={() => move(index, -1)} className="rounded px-2 py-1 text-sm hover:bg-white disabled:opacity-30" aria-label={`${index + 1}番目の商品を上へ`}>↑</button>
              <button type="button" disabled={index === items.length - 1 || isUploading} onClick={() => move(index, 1)} className="rounded px-2 py-1 text-sm hover:bg-white disabled:opacity-30" aria-label={`${index + 1}番目の商品を下へ`}>↓</button>
              <button type="button" disabled={isUploading} onClick={() => removeItem(index)} className="rounded px-2 py-1 text-sm text-red-700 hover:bg-red-50">削除</button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={items.length >= 20 || isUploading} onClick={() => setItems((current) => [...current, { id: crypto.randomUUID(), name: "", price: "", description: "" }])} className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50">＋ 商品を追加</button>
        <SaveButton disabled={isUploading} />
      </div>
    </form>
  );
}
