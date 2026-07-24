/**
 * StoreからNeumosBrief.realDataを組み立てる（純関数）。
 *
 * storesテーブルには既にGoogle Places由来の address/phone/opening_hours/
 * rating/review_count/instagram_url が保存されており、写真もraw_payload.photos
 * （Places API (New) のレスポンスをそのまま保持）に photo reference が入っている。
 * これらをそのままNeumos AIへ渡し、Website Rendererの店舗情報カード・
 * ギャラリーで「取得できた項目だけ」表示させる（無い項目は捏造しない）。
 *
 * 写真は `/api/places/photo` プロキシ（サーバ側でGOOGLE_PLACES_API_KEYを使い、
 * 実画像URLへ302する）を経由したURLにして渡す。Neumos AI側はGoogle API keyを
 * 一切持たずに済む。
 */
import type { Store, StoreRealData } from "@/lib/types";

const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
const MAX_PHOTOS = 6;

function resolvePhotoUrls(store: Store): string[] | undefined {
  // 写真プロキシがAPIキー未設定で動作しない場合、壊れた画像URLを埋め込まないようにする。
  if (!process.env.GOOGLE_PLACES_API_KEY?.trim()) return undefined;
  if (store.source !== "google_places") return undefined;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_BASE_URL?.trim().replace(/\/$/, "");
  if (!baseUrl) return undefined; // 絶対URLを組み立てるためのベースURLが無ければ諦める

  const photos = (store.raw_payload as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(photos)) return undefined;

  const names = photos
    .map((p) => (p && typeof p === "object" && "name" in p ? (p as { name: unknown }).name : undefined))
    .filter((name): name is string => typeof name === "string" && PHOTO_NAME_PATTERN.test(name))
    .slice(0, MAX_PHOTOS);

  if (names.length === 0) return undefined;
  return names.map((name) => `${baseUrl}/api/places/photo?name=${encodeURIComponent(name)}&w=800`);
}

export function buildStoreRealData(store: Store): StoreRealData | undefined {
  const data: StoreRealData = {};
  if (store.address) data.address = store.address;
  if (store.phone) data.phone = store.phone;
  if (store.opening_hours?.weekday_text?.length) data.openingHours = store.opening_hours.weekday_text;
  if (store.instagram_url) data.instagramUrl = store.instagram_url;
  if (typeof store.rating === "number") data.googleRating = store.rating;
  if (store.review_count) data.googleReviewCount = store.review_count;

  const photoUrls = resolvePhotoUrls(store);
  if (photoUrls) data.photoUrls = photoUrls;

  return Object.keys(data).length > 0 ? data : undefined;
}
