import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkNeumosApiAuth, neumosApiAuthError } from "@/lib/neumos-api-auth";
import { InquiryStorageUnavailableError, deleteInquiryById } from "@/lib/inquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * 管理者による個別の物理削除。GET /v1/inquiriesと同じ認証境界
 * （NEUMOS_API_KEYのBearer認証、未設定404・不正401、fail-closed）を使う。
 * 論理削除（deleted_at）は採用しない。レスポンス・ログにPII（氏名・メール・
 * 電話・本文）は一切含めない。
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }): Promise<NextResponse> {
  const auth = checkNeumosApiAuth(request);
  if (!auth.authorized) return neumosApiAuthError(auth.status);

  const parsedId = IdSchema.safeParse(params.id);
  if (!parsedId.success) {
    return json({ error: "invalid id" }, 400);
  }

  try {
    const outcome = await deleteInquiryById(parsedId.data);
    if (outcome === "not_found") {
      return json({ error: "not found" }, 404);
    }
    return json({ ok: true, id: parsedId.data }, 200);
  } catch (error) {
    const status = error instanceof InquiryStorageUnavailableError ? 503 : 500;
    console.error("[neumos-ai] inquiry delete route failed", { status });
    return json(
      { error: status === 503 ? "inquiry storage unavailable" : "failed to delete inquiry" },
      status
    );
  }
}
