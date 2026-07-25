import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isDiagnosticAuthorized } from "@/lib/brand-director/diagnostics/auth";
import { redactPlanPhotoUrls } from "@/lib/brand-director/diagnostics/redact-plan";
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
 * x-diagnostic-tokenヘッダーがBRAND_DIRECTOR_DIAGNOSTIC_TOKENと一致しない限り401。
 * OpenAI呼び出し自体はopenaiBrandDirectionProviderにそのまま委譲するため、
 * モデル未設定・タイムアウト・スキーマ不一致等はこれまで通りrule-providerへ
 * 安全にフォールバックする（この診断ルート自体が例外で落ちることはない）。
 *
 * レスポンスにAPIキー・Authorizationヘッダー・OpenAIレスポンス全文・
 * 写真URLの生値・内部プロンプト全文は含めない
 * （photoAssignments[].photoUrlはphoto#1等のラベルへ置き換える）。
 *
 * 診断が不要になったら、このファイルを含む src/app/api/admin/brand-director/ と
 * src/lib/brand-director/diagnostics/ をまとめて削除すること。
 */
export const dynamic = "force-dynamic";

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

const RequestBodySchema = z.object({
  brief: z
    .object({
      storeName: z.string().min(1).optional(),
      industry: z.string().min(1).optional(),
      area: z.string().min(1).optional(),
      targetCustomer: z.string().min(1).optional(),
      mainProblem: z.string().min(1).optional(),
      salesAngle: z.string().min(1).optional(),
      websiteGoal: z.string().min(1).optional(),
      siteConcept: z.string().min(1).optional(),
      recommendedPages: z.array(z.string()).optional(),
      seoKeywords: z.array(z.string()).optional(),
      tone: z.string().min(1).optional(),
      offer: z.string().min(1).optional(),
    })
    .optional(),
  photoUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  if (!isDiagnosticAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  const parsedBody = RequestBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request_body" }, { status: 400 });
  }

  const { brief: briefOverride, photoUrl } = parsedBody.data;
  const requestId = randomUUID();
  const brief: StoreBrief = {
    ...DEFAULT_DIAGNOSTIC_BRIEF,
    ...briefOverride,
    realData: photoUrl ? { photoUrls: [photoUrl] } : undefined,
  };
  const input = { requestId, brief };

  const photoAnalyses = photoUrl ? await openaiBrandDirectionProvider.analyzePhotos([photoUrl], input) : undefined;
  const result = await openaiBrandDirectionProvider.analyzeBrand(input, photoAnalyses);
  const schemaValid = BrandPlanSchema.safeParse(result.plan).success;

  return NextResponse.json({
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
