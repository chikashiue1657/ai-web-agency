/**
 * GET /api/places/photo?name=places/XXX/photos/YYY&w=800
 * Place Photo (New) をサーバ経由で解決し、実画像URLへリダイレクトする。
 * - APIキーをブラウザに晒さないためのプロキシ。
 * - skipHttpRedirect=true で {photoUri} を取得し、その公開URLへ302。
 * - name は "places/.../photos/..." 形式に限定（SSRF防止）。
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const PHOTO_NAME_PATTERN = /^places\/([A-Za-z0-9_-]+)\/photos\/[A-Za-z0-9_-]+$/;

type PhotoMedia = { photoUri?: string };
type PlacePhotos = { photos?: Array<{ name?: string }> };

async function fetchPhotoMedia(name: string, width: number, apiKey: string): Promise<Response> {
  return fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true`,
    { headers: { "X-Goog-Api-Key": apiKey } }
  );
}

async function refreshPhotoName(
  placeId: string,
  requestedIndex: number,
  apiKey: string
): Promise<string | undefined> {
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });
  if (!response.ok) {
    logger.warn("places.photo refresh failed", { status: response.status });
    return undefined;
  }
  const photos = ((await response.json()) as PlacePhotos).photos ?? [];
  if (photos.length === 0) return undefined;
  const index = Math.min(Math.max(requestedIndex, 0), photos.length - 1);
  const refreshedName = photos[index]?.name;
  return typeof refreshedName === "string" && PHOTO_NAME_PATTERN.test(refreshedName)
    ? refreshedName
    : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "";
  const w = Math.min(Math.max(Number(url.searchParams.get("w") ?? 800), 100), 1600);
  const requestedIndex = Math.max(Number.parseInt(url.searchParams.get("i") ?? "0", 10) || 0, 0);

  // 形式チェック（Places photo リソース名のみ許可）
  const nameMatch = PHOTO_NAME_PATTERN.exec(name);
  if (!nameMatch) {
    return NextResponse.json({ ok: false, error: "invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "places not configured" }, { status: 503 });
  }

  try {
    let res = await fetchPhotoMedia(name, w, apiKey);
    // Googleの写真名は期限切れになることがある。400のときだけPlace Detailsから
    // 最新の写真名を取り直し、同じ並び位置の写真で1回だけ復旧を試みる。
    if (res.status === 400) {
      const refreshedName = await refreshPhotoName(nameMatch[1], requestedIndex, apiKey);
      if (refreshedName) res = await fetchPhotoMedia(refreshedName, w, apiKey);
    }
    if (!res.ok) {
      logger.warn("places.photo failed", { status: res.status });
      return NextResponse.json({ ok: false, error: "photo fetch failed" }, { status: 502 });
    }
    const json = (await res.json()) as PhotoMedia;
    if (!json.photoUri) {
      return NextResponse.json({ ok: false, error: "no photoUri" }, { status: 502 });
    }
    // 実画像URL（キー不要のCDN URL）へリダイレクト
    const response = NextResponse.redirect(json.photoUri, 302);
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=3600");
    return response;
  } catch (err) {
    logger.error("places.photo error", { error: String(err) });
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
