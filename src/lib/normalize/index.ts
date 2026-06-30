/**
 * 店舗データ正規化（純関数群）。
 *
 * 役割:
 *  - Google Places / Apify / CSV の異なる入力を `NormalizedStore` に統一。
 *  - 欠損値・URL表記揺れ・件数ノイズに強い。
 *  - has_website はポータル/SNSを除外して厳密に判定。
 *  - 副作用なし（DBアクセスは repo 層に分離）→ unit test 容易。
 */
import type { NormalizedStore, StoreSource } from "@/lib/types";
import {
  extractUrls,
  normalizeUrl,
  isInstagramUrl,
  isFacebookUrl,
  looksLikeOfficialWebsite,
} from "./url";
import {
  toStr,
  toCount,
  toRating,
  normalizeCategory,
  inferArea,
} from "./helpers";

/** has_website 判定: website_url が「公式サイト」と言える場合のみ true。 */
export function decideHasWebsite(websiteUrl: string | null): boolean {
  return looksLikeOfficialWebsite(websiteUrl);
}

/** 共通の最終組み立て（各ソース正規化の合流点）。 */
function assemble(input: {
  place_id: string | null;
  name: string | null;
  category: unknown;
  address: string | null;
  phone: string | null;
  opening_hours: string[] | null;
  rating: unknown;
  review_count: unknown;
  photo_count: unknown;
  urlCandidates: unknown[];
  area?: unknown;
  source: StoreSource;
  raw: Record<string, unknown>;
}): NormalizedStore {
  const { website_url, instagram_url, facebook_url } = extractUrls(
    ...input.urlCandidates
  );
  const name = toStr(input.name) ?? "(名称不明)";
  return {
    place_id: toStr(input.place_id),
    name,
    category: normalizeCategory(input.category),
    address: toStr(input.address),
    phone: toStr(input.phone),
    opening_hours: input.opening_hours?.length
      ? { weekday_text: input.opening_hours }
      : null,
    rating: toRating(input.rating),
    review_count: toCount(input.review_count),
    photo_count: toCount(input.photo_count),
    website_url,
    instagram_url,
    facebook_url,
    has_website: decideHasWebsite(website_url),
    area: inferArea(input.address, input.area),
    source: input.source,
    raw_payload: input.raw,
  };
}

// ------------------------------------------------------------
// Google Places API 形式
//   Place Details / Nearby Search の代表的フィールドを吸収。
// ------------------------------------------------------------
export interface GooglePlaceInput {
  place_id?: string;
  name?: string;
  types?: string[];
  formatted_address?: string;
  vicinity?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  opening_hours?: { weekday_text?: string[] };
  rating?: number;
  user_ratings_total?: number;
  photos?: unknown[];
  website?: string;
  url?: string; // Googleマップ上のURL（公式HPではない）
  [key: string]: unknown;
}

export function normalizeGooglePlace(input: GooglePlaceInput): NormalizedStore {
  return assemble({
    place_id: input.place_id ?? null,
    name: input.name ?? null,
    category: input.types?.[0] ?? input.types?.join(","),
    address: input.formatted_address ?? input.vicinity ?? null,
    phone:
      input.formatted_phone_number ?? input.international_phone_number ?? null,
    opening_hours: input.opening_hours?.weekday_text ?? null,
    rating: input.rating,
    review_count: input.user_ratings_total,
    photo_count: Array.isArray(input.photos) ? input.photos.length : 0,
    // websiteは公式HP候補。url(Googleマップ)はSNS/公式判定に通すので候補に含める。
    urlCandidates: [input.website, input.url],
    source: "google_places",
    raw: input as Record<string, unknown>,
  });
}

// ------------------------------------------------------------
// Apify (Google Maps Scraper等) 形式
//   フィールド名がプロジェクトにより揺れるため広めに拾う。
// ------------------------------------------------------------
export interface ApifyInput {
  placeId?: string;
  title?: string;
  categoryName?: string;
  categories?: string[];
  address?: string;
  phone?: string;
  phoneUnformatted?: string;
  openingHours?: Array<{ day?: string; hours?: string }> | string[];
  totalScore?: number;
  reviewsCount?: number;
  imagesCount?: number;
  images?: unknown[];
  website?: string;
  url?: string;
  // SNSが別フィールドや additionalInfo に入るケースを吸収
  instagram?: string;
  facebook?: string;
  socialMedia?: Record<string, string>;
  [key: string]: unknown;
}

export function normalizeApify(input: ApifyInput): NormalizedStore {
  const ohText: string[] | null = Array.isArray(input.openingHours)
    ? input.openingHours.map((h) =>
        typeof h === "string" ? h : `${h.day ?? ""} ${h.hours ?? ""}`.trim()
      )
    : null;

  return assemble({
    place_id: input.placeId ?? null,
    name: input.title ?? null,
    category: input.categoryName ?? input.categories?.[0],
    address: input.address ?? null,
    phone: input.phone ?? input.phoneUnformatted ?? null,
    opening_hours: ohText,
    rating: input.totalScore,
    review_count: input.reviewsCount,
    photo_count:
      input.imagesCount ?? (Array.isArray(input.images) ? input.images.length : 0),
    urlCandidates: [
      input.website,
      input.url,
      input.instagram,
      input.facebook,
      input.socialMedia ? Object.values(input.socialMedia) : null,
    ],
    source: "apify",
    raw: input as Record<string, unknown>,
  });
}

// ------------------------------------------------------------
// CSV 形式（ヘッダ揺れに寛容なキー解決）
// ------------------------------------------------------------
export type CsvRow = Record<string, string>;

/** 複数候補キーから最初に存在する値を返す（大文字小文字/別名吸収）。 */
function pick(row: CsvRow, keys: string[]): string | undefined {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v;
  for (const k of keys) {
    const v = lower[k.toLowerCase()];
    if (v != null && String(v).trim() !== "") return v;
  }
  return undefined;
}

export function normalizeCsvRow(row: CsvRow): NormalizedStore {
  const website = pick(row, ["website", "website_url", "url", "hp", "ホームページ"]);
  const insta = pick(row, ["instagram", "instagram_url", "ig", "インスタ"]);
  const fb = pick(row, ["facebook", "facebook_url", "fb"]);
  const ohRaw = pick(row, ["opening_hours", "hours", "営業時間"]);

  return assemble({
    place_id: pick(row, ["place_id", "placeid"]) ?? null,
    name: pick(row, ["name", "店名", "店舗名", "title"]) ?? null,
    category: pick(row, ["category", "業種", "type", "categoryname"]),
    address: pick(row, ["address", "住所"]) ?? null,
    phone: pick(row, ["phone", "tel", "電話", "電話番号"]) ?? null,
    opening_hours: ohRaw ? ohRaw.split(/[;／/|]/).map((s) => s.trim()) : null,
    rating: pick(row, ["rating", "評価", "score", "totalscore"]),
    review_count: pick(row, ["review_count", "reviews", "口コミ数", "reviewscount"]),
    photo_count: pick(row, ["photo_count", "photos", "写真数", "imagescount"]),
    urlCandidates: [website, insta, fb],
    area: pick(row, ["area", "エリア", "市町村"]),
    source: "csv",
    raw: row as Record<string, unknown>,
  });
}

// ------------------------------------------------------------
// ディスパッチャ: source を指定して正規化
// ------------------------------------------------------------
export function normalizeBySource(
  source: StoreSource,
  payload: unknown
): NormalizedStore {
  switch (source) {
    case "google_places":
      return normalizeGooglePlace(payload as GooglePlaceInput);
    case "apify":
      return normalizeApify(payload as ApifyInput);
    case "csv":
      return normalizeCsvRow(payload as CsvRow);
    case "manual":
    default:
      // manual はそのまま NormalizedStore に近い形を期待しつつ最低限を整える
      return normalizeCsvRow(payload as CsvRow);
  }
}

// re-export（呼び出し側の利便）
export { normalizeUrl, isInstagramUrl, isFacebookUrl, extractUrls };
