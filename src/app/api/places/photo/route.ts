/**
 * GET /api/places/photo?placeId=XXX&i=0&w=800
 *
 * 期限付きのGoogle写真名をDBや生成ページへ保存せず、保存可能なplaceIdと
 * 並び位置から毎回最新情報を取得する。meta=1では作者表示と元写真リンクに
 * 必要な公開情報だけを返す。旧name形式もplaceIdだけを抽出して互換維持する。
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const PHOTO_NAME_PATTERN = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/;

type PhotoMedia = { photoUri?: string };
type PlacePhoto = {
  name?: string;
  googleMapsUri?: string;
  authorAttributions?: Array<{ displayName?: string; uri?: string; photoUri?: string }>;
};
type PlacePhotos = { photos?: PlacePhoto[] };

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

function cacheSuccessfulPhoto(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  response.headers.set("Access-Control-Allow-Origin", "*");
  return response;
}

function resolvePlaceId(url: URL): string | undefined {
  const placeId = url.searchParams.get("placeId")?.trim();
  if (placeId && PLACE_ID_PATTERN.test(placeId)) return placeId;
  return PHOTO_NAME_PATTERN.exec(url.searchParams.get("name") ?? "")?.[1];
}

async function fetchCurrentPhoto(placeId: string, requestedIndex: number, apiKey: string) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "photos" },
    cache: "no-store",
  });
  if (!response.ok) {
    logger.warn("places.photo details failed", { status: response.status });
    return undefined;
  }
  const photos = ((await response.json()) as PlacePhotos).photos ?? [];
  if (photos.length === 0) return undefined;
  const index = Math.min(Math.max(requestedIndex, 0), photos.length - 1);
  const photo = photos[index];
  return typeof photo?.name === "string" && PHOTO_NAME_PATTERN.test(photo.name) ? photo : undefined;
}

async function fetchPhotoMedia(name: string, width: number, apiKey: string): Promise<Response> {
  return fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey }, cache: "no-store" }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = resolvePlaceId(url);
  const widthNumber = Number(url.searchParams.get("w") ?? 800);
  const width = Math.min(Math.max(Number.isFinite(widthNumber) ? widthNumber : 800, 100), 1600);
  const requestedIndex = Math.max(Number.parseInt(url.searchParams.get("i") ?? "0", 10) || 0, 0);

  if (!placeId) {
    return noStore(NextResponse.json({ ok: false, error: "invalid place id" }, { status: 400 }));
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return noStore(NextResponse.json({ ok: false, error: "places not configured" }, { status: 503 }));
  }

  try {
    const photo = await fetchCurrentPhoto(placeId, requestedIndex, apiKey);
    if (!photo?.name) {
      return noStore(NextResponse.json({ ok: false, error: "photo not found" }, { status: 404 }));
    }
    if (url.searchParams.get("meta") === "1") {
      return noStore(NextResponse.json({
        authorAttributions: photo.authorAttributions ?? [],
        googleMapsUri: photo.googleMapsUri,
      }));
    }
    const media = await fetchPhotoMedia(photo.name, width, apiKey);
    if (!media.ok) {
      logger.warn("places.photo media failed", { status: media.status });
      return noStore(NextResponse.json({ ok: false, error: "photo fetch failed" }, { status: 502 }));
    }
    const json = (await media.json()) as PhotoMedia;
    if (!json.photoUri) {
      return noStore(NextResponse.json({ ok: false, error: "no photoUri" }, { status: 502 }));
    }
    return cacheSuccessfulPhoto(NextResponse.redirect(json.photoUri, 302));
  } catch (err) {
    logger.error("places.photo error", { error: String(err) });
    return noStore(NextResponse.json({ ok: false, error: "internal error" }, { status: 500 }));
  }
}
