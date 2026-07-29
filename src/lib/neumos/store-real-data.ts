/**
 * StoreからNeumosBrief.realDataを組み立てる（純関数）。
 *
 * storesテーブルには既にGoogle Places由来の address/phone/opening_hours/
 * rating/review_count/instagram_url/website_url が保存されており、写真も
 * raw_payload.photos（Places API (New) のレスポンスをそのまま保持）に
 * photo reference が入っている。これらをそのままNeumos AIへ渡し、
 * Website Rendererの店舗情報カード・ギャラリーで「取得できた項目だけ」
 * 表示させる（無い項目は捏造しない）。
 *
 * googleMapsUrlだけは専用のDB列を持たず、raw_payload.googleMapsUri
 * （Places API (New) のレスポンスをそのまま保持している値）から直接取り出す。
 * websiteUrlは既存のstore.website_url列（normalize/url.tsが既にSNS/ポータルを
 * 除外し「公式サイトらしいURL」だけに絞り込み済み）をそのまま使う。
 *
 * 写真は `/api/places/photo` プロキシ（サーバ側でGOOGLE_PLACES_API_KEYを使い、
 * 実画像URLへ302する）を経由したURLにして渡す。Neumos AI側はGoogle API keyを
 * 一切持たずに済む。
 */
import type { Store, StoreRealData } from "@/lib/types";

const PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;
const MAX_PHOTOS = 6;

const GOOGLE_MAPS_URL_PATTERN = /^https:\/\//i;

/**
 * raw_payload.googleMapsUri（Places API (New) のgoogleMapsUriそのもの）を取り出す。
 * source が google_places 以外の行はPlaces由来のフィールド名を持たない（apify/csv/manual等は
 * raw_payloadの形状が異なる）ため対象外にする。httpsで始まらない値・文字列以外は
 * 採用しない（Places側は常にhttpsを返す契約のため、それ以外は取得元不明の値として扱う）。
 */
function resolveGoogleMapsUrl(store: Store): string | undefined {
  if (store.source !== "google_places") return undefined;
  const raw = (store.raw_payload as { googleMapsUri?: unknown } | null)?.googleMapsUri;
  return typeof raw === "string" && GOOGLE_MAPS_URL_PATTERN.test(raw) ? raw : undefined;
}

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
  if (store.website_url) data.websiteUrl = store.website_url;

  const photoUrls = resolvePhotoUrls(store);
  if (photoUrls) data.photoUrls = photoUrls;

  const googleMapsUrl = resolveGoogleMapsUrl(store);
  if (googleMapsUrl) data.googleMapsUrl = googleMapsUrl;

  return Object.keys(data).length > 0 ? data : undefined;
}
