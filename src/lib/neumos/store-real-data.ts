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

/**
 * このファイル内で実際に確認できるgoogleMapsUriの取得形式（tests/normalize.test.ts・
 * tests/store-real-data.test.tsのfixture、normalize/url.tsのNON_WEBSITE_HOSTS判定）は
 * いずれも"maps.google.com"のみである。推測で他ドメイン（www.google.com/google.com等）
 * を広く許可せず、実際に確認できた形式だけに限定する。
 */
const ALLOWED_GOOGLE_MAPS_HOSTS = new Set(["maps.google.com"]);

/**
 * raw_payload.googleMapsUri（Places API (New) のgoogleMapsUriそのもの）を取り出す。
 * source が google_places 以外の行はPlaces由来のフィールド名を持たない（apify/csv/manual等は
 * raw_payloadの形状が異なる）ため対象外にする。
 *
 * new URL()で解析できない値・https以外・ALLOWED_GOOGLE_MAPS_HOSTSに無いホスト・
 * user:password@形式の認証情報付きURLは採用せず、この項目だけをundefinedにする
 * （生成リクエスト全体は失敗させない）。ホストの一致は完全一致のみ（endsWith等の
 * サフィックス一致は"maps.google.com.evil.example"のような偽装ホストを通して
 * しまうため使わない）。認証情報チェックにより
 * "https://maps.google.com@evil.example/"（実際のホストはevil.example）・
 * "https://user:password@maps.google.com/"のどちらも拒否する。
 */
function resolveGoogleMapsUrl(store: Store): string | undefined {
  if (store.source !== "google_places") return undefined;
  const raw = (store.raw_payload as { googleMapsUri?: unknown } | null)?.googleMapsUri;
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return undefined;
    if (url.username || url.password) return undefined;
    if (!ALLOWED_GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase())) return undefined;
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * store.website_urlを実際にNeumosへ送ってよい安全なURLかどうか検証する。
 * normalize/url.tsのnormalizeUrl()が保存時に既に大半のゴミを弾いているはずだが、
 * 過去に保存された値・DB上の手動編集等で不正な値が紛れ込む可能性を考慮し、
 * 送信直前にもう一段独立して検証する（不正ならこの項目だけundefinedにし、
 * 他のrealDataフィールドはそのまま送る）。
 *
 * 決定した挙動: 前後の空白のみtrimしてから検証する（内部の空白は矯正せず、
 * trim後もURLとして解析できなければ拒否する）。空白だけの値はtrim後に空文字列
 * となり拒否される。スキーム省略の相対URL・javascript:/data:/ftp:等の
 * 非http(s)スキーム・new URL()で解析できない値はすべて拒否する（相対URLを
 * 「たぶんこうだろう」と推測してhttps://を補完することはしない＝架空のURLを
 * 作らない）。
 */
function resolveWebsiteUrl(store: Store): string | undefined {
  const raw = store.website_url;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
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
  return names.map(
    (name, index) =>
      `${baseUrl}/api/places/photo?name=${encodeURIComponent(name)}&w=800&i=${index}`
  );
}

export function buildStoreRealData(store: Store): StoreRealData | undefined {
  const data: StoreRealData = {};
  if (store.address) data.address = store.address;
  if (store.phone) data.phone = store.phone;
  if (store.opening_hours?.weekday_text?.length) data.openingHours = store.opening_hours.weekday_text;
  if (store.instagram_url) data.instagramUrl = store.instagram_url;
  if (typeof store.rating === "number") data.googleRating = store.rating;
  if (store.review_count) data.googleReviewCount = store.review_count;

  const websiteUrl = resolveWebsiteUrl(store);
  if (websiteUrl) data.websiteUrl = websiteUrl;

  const photoUrls = resolvePhotoUrls(store);
  if (photoUrls) data.photoUrls = photoUrls;

  const googleMapsUrl = resolveGoogleMapsUrl(store);
  if (googleMapsUrl) data.googleMapsUrl = googleMapsUrl;

  return Object.keys(data).length > 0 ? data : undefined;
}
