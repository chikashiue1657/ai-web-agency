/**
 * 診断ルート専用のレスポンスヘルパー。全レスポンス（成功・エラー問わず）へ
 * 共有CDN/ブラウザキャッシュ禁止と検索避けのヘッダーを一律で付与する。
 * GET /modelsの結果にはAPIキー別の利用権限情報が含まれるため、
 * 特にキャッシュへ残さないことが重要。
 */
import { NextResponse } from "next/server";

export const DIAGNOSTIC_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
} as const;

export function diagnosticJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: DIAGNOSTIC_HEADERS });
}

/** 認証トークン未設定時（fail-closed）にルートの存在自体を隠すための、本文無し404。 */
export function diagnosticEmpty(status: number) {
  return new NextResponse(null, { status, headers: DIAGNOSTIC_HEADERS });
}
