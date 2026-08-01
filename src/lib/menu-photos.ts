import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const MENU_PHOTO_BUCKET = "menu-images";
export const MAX_MENU_PHOTO_BYTES = 5 * 1024 * 1024;
export const MENU_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const MIME_CONFIG = {
  "image/jpeg": { extension: "jpg" },
  "image/png": { extension: "png" },
  "image/webp": { extension: "webp" },
} as const;
type SupportedMime = keyof typeof MIME_CONFIG;
const STORE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export type MenuPhotoResult =
  | { ok: true; imageUrl: string; imagePath: string }
  | { ok: false; error: string };

export function detectMenuPhotoMime(bytes: Uint8Array): SupportedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function isStoreMenuPhotoPath(storeId: string, path: string): boolean {
  return STORE_ID_PATTERN.test(storeId)
    && path.startsWith(`stores/${storeId}/menu/`)
    && !path.includes("..")
    && path.length <= 240;
}

async function ensureBucket() {
  const client = getSupabaseAdmin();
  if (!client) throw new Error("画像保存先が設定されていません");
  const { data } = await client.storage.getBucket(MENU_PHOTO_BUCKET);
  if (!data) {
    const created = await client.storage.createBucket(MENU_PHOTO_BUCKET, {
      public: true,
      fileSizeLimit: MAX_MENU_PHOTO_BYTES,
      allowedMimeTypes: Object.keys(MIME_CONFIG),
    });
    if (created.error && !created.error.message.toLowerCase().includes("already exists")) {
      throw new Error(`画像保存先を準備できませんでした: ${created.error.message}`);
    }
  }
  return client;
}

export async function uploadMenuPhoto(storeId: string, file: File): Promise<MenuPhotoResult> {
  if (!STORE_ID_PATTERN.test(storeId)) return { ok: false, error: "店舗IDが正しくありません" };
  if (!file || file.size === 0) return { ok: false, error: "写真を選択してください" };
  if (file.size > MAX_MENU_PHOTO_BYTES) return { ok: false, error: "写真は5MB以下にしてください" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectMenuPhotoMime(bytes);
  if (!detectedMime) return { ok: false, error: "JPEG・PNG・WebPの写真を選択してください" };
  try {
    const client = await ensureBucket();
    const imagePath = `stores/${storeId}/menu/${randomUUID()}.${MIME_CONFIG[detectedMime].extension}`;
    const { error } = await client.storage.from(MENU_PHOTO_BUCKET).upload(imagePath, bytes, {
      contentType: detectedMime,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) return { ok: false, error: `写真を保存できませんでした: ${error.message}` };
    const { data } = client.storage.from(MENU_PHOTO_BUCKET).getPublicUrl(imagePath);
    return { ok: true, imageUrl: data.publicUrl, imagePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "写真を保存できませんでした" };
  }
}

export async function deleteMenuPhoto(storeId: string, imagePath: string): Promise<{ ok: boolean; error?: string }> {
  if (!isStoreMenuPhotoPath(storeId, imagePath)) return { ok: false, error: "写真の保存場所が正しくありません" };
  const client = getSupabaseAdmin();
  if (!client) return { ok: false, error: "画像保存先が設定されていません" };
  const { error } = await client.storage.from(MENU_PHOTO_BUCKET).remove([imagePath]);
  return error ? { ok: false, error: `写真を削除できませんでした: ${error.message}` } : { ok: true };
}

export function getMenuPhotoPublicUrl(storeId: string, imagePath: string): string | undefined {
  if (!isStoreMenuPhotoPath(storeId, imagePath)) return undefined;
  const client = getSupabaseAdmin();
  if (!client) return undefined;
  return client.storage.from(MENU_PHOTO_BUCKET).getPublicUrl(imagePath).data.publicUrl;
}
