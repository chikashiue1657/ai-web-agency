/**
 * Google Places API (New) クライアント。
 * - Text Search (places:searchText) を用いてキーワードから店舗候補を取得。
 * - APIキーは server 専用の GOOGLE_PLACES_API_KEY を使用（クライアントへ出さない）。
 * - FieldMask で必要フィールドのみ取得しコスト/レイテンシを抑える。
 *
 * 参考: https://developers.google.com/maps/documentation/places/web-service/text-search
 */
import { logger } from "@/lib/logger";
import { ServiceError } from "@/lib/errors";

/** Places API (New) の1件分（必要フィールドのみ）。 */
export interface PlacesNewResult {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string }>;
  [key: string]: unknown;
}

/** 取得したいフィールド（FieldMask）。課金対象なので必要最小限に。 */
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.regularOpeningHours",
  "places.photos",
].join(",");

export function isPlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

export interface PlacesSearchOptions {
  /** 最大取得件数（Places APIのpageSizeは最大20）。 */
  maxResults?: number;
  /** 言語・地域（既定は日本語/日本）。 */
  languageCode?: string;
  regionCode?: string;
}

/**
 * テキスト検索で店舗候補を取得する。
 * APIキー未設定や失敗時は ServiceError を投げる（呼び出し側でハンドリング）。
 */
export async function searchTextPlaces(
  query: string,
  opts: PlacesSearchOptions = {}
): Promise<PlacesNewResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new ServiceError(
      "places_not_configured",
      "GOOGLE_PLACES_API_KEY が未設定です。サーバの環境変数を設定してください。",
      503
    );
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: opts.languageCode ?? "ja",
      regionCode: opts.regionCode ?? "JP",
      pageSize: Math.min(Math.max(opts.maxResults ?? 20, 1), 20),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    logger.warn("places.searchText failed", { status: res.status, detail: detail.slice(0, 500) });
    // Googleのエラーは {"error":{"code","message","status"}} 形式。
    // 実際のメッセージ（例: "API key not valid" / "requests ... are blocked"）を
    // そのまま伝えると原因切り分けが容易になる。
    let googleMessage = "";
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string; status?: string } };
      googleMessage = parsed.error?.message ?? "";
    } catch {
      /* JSONでない場合は無視 */
    }
    throw new ServiceError(
      "places_api_error",
      `Google Places API エラー (${res.status})${googleMessage ? `: ${googleMessage}` : ""}`,
      502
    );
  }

  const json = (await res.json()) as { places?: PlacesNewResult[] };
  return json.places ?? [];
}
