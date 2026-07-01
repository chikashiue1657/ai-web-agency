import { NextRequest, NextResponse } from "next/server";
import { getGenerationRecord } from "@/lib/store";

/** 生成済みプレビューの単体HTMLをそのまま返す（iframe埋め込み・静的配信用途）。 */
export async function GET(_req: NextRequest, { params }: { params: { requestId: string } }) {
  const record = getGenerationRecord(params.requestId);
  if (!record) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return new NextResponse(record.previewHtml, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
