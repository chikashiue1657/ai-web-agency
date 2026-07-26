import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { checkDiagnosticAuth } from "@/lib/brand-director/diagnostics/auth";
import { diagnosticEmpty, diagnosticJson } from "@/lib/brand-director/diagnostics/http";
import { isRateLimited } from "@/lib/brand-director/diagnostics/rate-limit";
import { redactPlanPhotoUrls } from "@/lib/brand-director/diagnostics/redact-plan";
import { DiagnosticRequestBodySchema, MAX_DIAGNOSTIC_BODY_BYTES } from "@/lib/brand-director/diagnostics/request-schema";
import { openaiBrandDirectionProvider } from "@/lib/brand-director/openai-provider";
import { BrandPlanSchema } from "@/lib/brand-director/schema";
import type { StoreBrief } from "@/lib/types";

/**
 * POST /api/admin/brand-director/analyze
 *
 * Brand DirectorのOpenAI実装だけを実APIで確認するための、サーバー専用の
 * 一時的な診断エンドポイント。既存のv1/v2生成経路（/api/generate, /v1/contents）
 * からは呼ばれず、既存の生成挙動には一切影響しない。
 *
 * 認可はcheckDiagnosticAuth（fail-closed。トークン未設定なら404、不一致なら401）。
 * 写真URLは受け付けない（第三者URLをOpenAIへ送信させないため、初回疎通は
 * 写真なしのBrandPlan生成のみに限定。DiagnosticRequestBodySchemaにphotoUrl
 * フィールド自体が存在せず、.strict()により送っても400になる）。
 * Content-Type・body上限・スキーマ検証を経てから初めてOpenAIを呼ぶため、
 * 不正な巨大入力でOpenAI APIを呼ぶことはない。
 *
 * OpenAI呼び出し自体はopenaiBrandDirectionProviderにそのまま委譲するため、
 * モデル未設定・タイムアウト・スキーマ不一致等はこれまで通りrule-providerへ
 * 安全にフォールバックする（この診断ルート自体が例外で落ちることはない。
 * 1リクエストあたりの呼び出し回数は既存のMAX_RETRIES=1により初回+再試行1回まで）。
 *
 * レスポンスにAPIキー・診断トークン・Authorizationヘッダー・OpenAIレスポンス全文・
 * 写真URLの生値・内部プロンプト全文・stack traceは含めない
 * （photoAssignments[].photoUrlはphoto#1等のラベルへ置き換える）。
 *
 * 診断が不要になったら、このファイルを含む src/app/api/admin/brand-director/ と
 * src/lib/brand-director/diagnostics/ をまとめて削除すること。
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_DIAGNOSTIC_BRIEF: StoreBrief = {
  storeName: "診断用ダミー店舗",
  industry: "カフェ",
  area: "テストエリア",
  targetCustomer: "地元客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "落ち着いた店内体験",
  websiteGoal: "来店予約の増加",
  siteConcept: "静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯",
};

export async function POST(req: NextRequest) {
  const auth = checkDiagnosticAuth(req);
  if (!auth.authorized) {
    return auth.status === 404 ? diagnosticEmpty(404) : diagnosticJson({ error: "unauthorized" }, 401);
  }
  if (isRateLimited(auth.token)) {
    return diagnosticJson({ error: "rate_limited" }, 429);
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return diagnosticJson({ error: "unsupported_media_type" }, 415);
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_DIAGNOSTIC_BODY_BYTES) {
    return diagnosticJson({ error: "payload_too_large" }, 413);
  }

  let parsedJson: unknown = {};
  if (rawBody.trim().length > 0) {
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return diagnosticJson({ error: "invalid_json" }, 400);
    }
  }

  const parsedBody = DiagnosticRequestBodySchema.safeParse(parsedJson);
  if (!parsedBody.success) {
    return diagnosticJson({ error: "invalid_request_body" }, 400);
  }

  const requestId = randomUUID();
  const brief: StoreBrief = {
    ...DEFAULT_DIAGNOSTIC_BRIEF,
    ...parsedBody.data.brief,
  };
  const input = { requestId, brief };

  const result = await openaiBrandDirectionProvider.analyzeBrand(input);
  const schemaValid = BrandPlanSchema.safeParse(result.plan).success;

  return diagnosticJson({
    requestId,
    method: "diagnostic",
    provider: result.usage.provider,
    model: result.usage.model,
    plan: redactPlanPhotoUrls(result.plan),
    durationMs: result.usage.durationMs,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    fallbackReason: result.usage.fallbackReason,
    schemaValid,
  });
}
