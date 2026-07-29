import { NextRequest, NextResponse } from "next/server";
import { getGenerationRecord } from "@/lib/store";
import { toLegacyGeneratedContents } from "@/lib/bridge";
import { extractErrorDetail } from "@/lib/error-detail";
import { checkNeumosApiAuth, neumosApiAuthError } from "@/lib/neumos-api-auth";

/**
 * GET /v1/contents/{requestId} — MVP側のポーリング契約に対応する状態取得API。
 * `app/api/` 配下に置かないこと（`../route.ts` のコメント参照。パスがズレるとMVPから404になる）。
 * v1 は同期生成のため、生成済みリクエストは常に status="preview" を返す。
 *
 * Next.js App RouterはGETの動的ルートを既定でキャッシュしうるため、
 * Supabaseへ書き込んだ直後の行を必ず最新で読めるよう動的レンダリングを強制する。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { requestId: string } }) {
  const auth = checkNeumosApiAuth(req);
  if (!auth.authorized) {
    return neumosApiAuthError(auth.status);
  }

  try {
    const record = await getGenerationRecord(params.requestId);
    if (!record) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      requestId: record.requestId,
      status: record.status,
      previewUrl: record.previewUrl,
      publishedUrl: record.publishedUrl,
      generatedContents: toLegacyGeneratedContents(record.generatedContents, record.previewUrl),
    });
  } catch (err) {
    const detail = extractErrorDetail(err);
    console.error("[neumos-ai] v1/contents/[requestId] lookup failed", detail);
    return NextResponse.json({ error: "lookup failed", errorDetail: detail }, { status: 500 });
  }
}
