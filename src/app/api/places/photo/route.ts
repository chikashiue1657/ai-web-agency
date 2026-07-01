/**
 * GET /api/places/photo?name=places/XXX/photos/YYY&w=800
 * Place Photo (New) をサーバ経由で解決し、実画像URLへリダイレクトする。
 * - APIキーをブラウザに晒さないためのプロキシ。
 * - skipHttpRedirect=true で {photoUri} を取得し、その公開URLへ302。
 * - name は "places/.../photos/..." 形式に限定（SSRF防止）。
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "";
  const w = Math.min(Math.max(Number(url.searchParams.get("w") ?? 800), 100), 1600);

  // 形式チェック（Places photo リソース名のみ許可）
  if (!/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) {
    return NextResponse.json({ ok: false, error: "invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "places not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": apiKey } }
    );
    if (!res.ok) {
      logger.warn("places.photo failed", { status: res.status });
      return NextResponse.json({ ok: false, error: "photo fetch failed" }, { status: 502 });
    }
    const json = (await res.json()) as { photoUri?: string };
    if (!json.photoUri) {
      return NextResponse.json({ ok: false, error: "no photoUri" }, { status: 502 });
    }
    // 実画像URL（キー不要のCDN URL）へリダイレクト
    return NextResponse.redirect(json.photoUri, 302);
  } catch (err) {
    logger.error("places.photo error", { error: String(err) });
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
