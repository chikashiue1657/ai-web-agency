import { NextRequest, NextResponse } from "next/server";
import { isDiagnosticAuthorized } from "@/lib/brand-director/diagnostics/auth";
import { checkModelAvailability } from "@/lib/brand-director/diagnostics/model-availability";

/**
 * GET /api/admin/brand-director/models
 *
 * 対象OpenAIアカウントでBrand Directorの推奨モデルが利用可能かを確認する
 * サーバー専用の一時的な診断エンドポイント。x-diagnostic-tokenヘッダーが
 * BRAND_DIRECTOR_DIAGNOSTIC_TOKENと一致しない限り401を返す。
 * 既存のv1/v2生成経路・Brand Director本体（provider.ts等）からは呼ばれない。
 *
 * 診断が不要になったら、このファイルを含む src/app/api/admin/brand-director/ と
 * src/lib/brand-director/diagnostics/ をまとめて削除すること。
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isDiagnosticAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await checkModelAvailability();
  if (!result.ok) {
    console.warn("[neumos-ai] brand-director diagnostic: model availability check failed", {
      errorType: result.errorType,
      message: result.message,
    });
    return NextResponse.json({ error: "model_availability_check_failed" }, { status: 502 });
  }

  return NextResponse.json({ available: result.available });
}
