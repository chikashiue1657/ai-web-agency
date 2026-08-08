import { NextRequest, NextResponse } from "next/server";
import { checkInquiryCleanupCronAuth } from "@/lib/inquiry-cleanup-auth";
import { InquiryStorageUnavailableError, cleanupExpiredInquiries } from "@/lib/inquiry-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const AUTH_ERROR_MESSAGE: Record<401 | 404 | 503, string> = {
  401: "unauthorized",
  404: "not found",
  503: "misconfigured",
};

/**
 * Vercel Cronからの1日1回の呼び出し専用（vercel.json参照）。CRON_SECRETを
 * 知っていれば手動での動作確認呼び出しも同じBearer認証で可能。
 * レスポンス・ログにPII（氏名・メール・電話・本文）は一切含めない
 * （削除条件がcreated_atのみで完結するため、そもそも読み取らない）。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = checkInquiryCleanupCronAuth(request);
  if (!auth.authorized) {
    return json({ error: AUTH_ERROR_MESSAGE[auth.status] }, auth.status);
  }

  try {
    const result = await cleanupExpiredInquiries();
    return json({ ok: true, ...result }, 200);
  } catch (error) {
    if (error instanceof InquiryStorageUnavailableError) {
      return json({ ok: false, error: "inquiry storage unavailable" }, 503);
    }
    console.error("[neumos-ai] inquiry cleanup route failed");
    return json({ ok: false, error: "cleanup failed" }, 500);
  }
}
