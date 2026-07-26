import { NextRequest } from "next/server";
import { checkDiagnosticAuth } from "@/lib/brand-director/diagnostics/auth";
import { diagnosticEmpty, diagnosticJson } from "@/lib/brand-director/diagnostics/http";
import { checkModelAvailability } from "@/lib/brand-director/diagnostics/model-availability";
import { isRateLimited } from "@/lib/brand-director/diagnostics/rate-limit";

/**
 * GET /api/admin/brand-director/models
 *
 * 対象OpenAIアカウントでBrand Directorの推奨モデルが利用可能かを確認する
 * サーバー専用の一時的な診断エンドポイント。BRAND_DIRECTOR_DIAGNOSTIC_TOKENが
 * 未設定なら404（ルートの存在自体を隠す・fail-closed）、x-diagnostic-token
 * ヘッダーが一致しない限り401を返す。GET以外のメソッドはNext.jsのルーティングに
 * より自動的に405となる（このファイルはGETのみexportしている）。
 *
 * 既存のv1/v2生成経路・Brand Director本体（provider.ts等）からは呼ばれない。
 * 診断が不要になったら、このファイルを含む src/app/api/admin/brand-director/ と
 * src/lib/brand-director/diagnostics/ をまとめて削除すること。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = checkDiagnosticAuth(req);
  if (!auth.authorized) {
    return auth.status === 404 ? diagnosticEmpty(404) : diagnosticJson({ error: "unauthorized" }, 401);
  }
  if (isRateLimited(auth.token)) {
    return diagnosticJson({ error: "rate_limited" }, 429);
  }

  const result = await checkModelAvailability();
  if (!result.ok) {
    console.warn("[neumos-ai] brand-director diagnostic: model availability check failed", {
      errorType: result.errorType,
      message: result.message,
    });
    return diagnosticJson({ error: "model_availability_check_failed" }, 502);
  }

  return diagnosticJson({ available: result.available });
}
