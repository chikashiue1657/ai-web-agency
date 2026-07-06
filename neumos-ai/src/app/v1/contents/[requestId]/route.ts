import { NextRequest, NextResponse } from "next/server";
import { getGenerationRecord } from "@/lib/store";
import { toLegacyGeneratedContents } from "@/lib/bridge";

/**
 * GET /v1/contents/{requestId} — MVP側のポーリング契約に対応する状態取得API。
 * `app/api/` 配下に置かないこと（`../route.ts` のコメント参照。パスがズレるとMVPから404になる）。
 * v1 は同期生成のため、生成済みリクエストは常に status="preview" を返す。
 */
export async function GET(_req: NextRequest, { params }: { params: { requestId: string } }) {
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
}
