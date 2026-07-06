import { NextRequest, NextResponse } from "next/server";
import { getGenerationRecord } from "@/lib/store";
import { extractErrorDetail } from "@/lib/error-detail";

/**
 * Next.js App RouterはGETの動的ルートを既定でキャッシュしうるため、
 * Supabaseへ書き込んだ直後の行を必ず最新で読めるよう動的レンダリングを強制する。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 生成済みプレビューの単体HTMLをそのまま返す（iframe埋め込み・静的配信用途）。 */
export async function GET(_req: NextRequest, { params }: { params: { requestId: string } }) {
  try {
    const record = await getGenerationRecord(params.requestId);
    if (!record) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return new NextResponse(record.previewHtml, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    const detail = extractErrorDetail(err);
    console.error("[neumos-ai] preview raw lookup failed", detail);
    return NextResponse.json({ error: "lookup failed", errorDetail: detail }, { status: 500 });
  }
}
