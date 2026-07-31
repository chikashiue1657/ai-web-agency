import { NextRequest, NextResponse } from "next/server";
import { GenerateRequestSchema } from "@/lib/validation";
import { GenerationTypeNotImplementedError } from "@/lib/engine";
import { performGeneration } from "@/lib/generate";
import { toLegacyGeneratedContents } from "@/lib/bridge";
import { IMPLEMENTED_GENERATION_TYPES } from "@/lib/types";
import { extractErrorDetail } from "@/lib/error-detail";
import { getSupabaseProjectRef } from "@/lib/supabase/server";
import { TABLE_NAME } from "@/lib/store";
import { checkNeumosApiAuth, neumosApiAuthError } from "@/lib/neumos-api-auth";

/**
 * POST /v1/contents — AI集客支援MVPの `NEUMOS_API_URL` 連携用エンドポイント。
 *
 * 重要: このルートは意図的に `app/api/` 配下ではなく `app/v1/` 配下に置いている。
 * MVP側 `src/lib/neumos/client.ts` は `fetch(\`${NEUMOS_API_URL}/v1/contents\`)` を
 * 直接叩く実装（`/api` prefixなし）で、`tests/neumos-live.test.ts` のモックサーバも
 * `/v1/contents` で固定検証済み。ここを `app/api/v1/contents/route.ts` に置くと
 * 実際のパスが `/api/v1/contents` になりMVPからの呼び出しが404になるため、
 * 移動しないこと（過去に実際にこの位置ズレで生成依頼が失敗した）。
 *
 * MVP側の想定契約:
 *   POST {NEUMOS_API_URL}/v1/contents  body: { generationType, brief }
 *   resp: { requestId, status, previewUrl?, publishedUrl?, generatedContents? }
 * にそのまま対応する。`generatedContents` はMVPの `GeneratedContent[]`
 * （`{type,title,url,body,meta}`）形式に変換して返す。
 */
export async function POST(req: NextRequest) {
  const auth = checkNeumosApiAuth(req);
  if (!auth.authorized) {
    return neumosApiAuthError(auth.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { generationType, brief } = parsed.data;

  try {
    const record = await performGeneration(generationType, brief, req.nextUrl.origin);
    return NextResponse.json(
      {
        requestId: record.requestId,
        status: record.status,
        previewUrl: record.previewUrl,
        publishedUrl: record.publishedUrl,
        generatedContents: toLegacyGeneratedContents(record.generatedContents, record.previewUrl),
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof GenerationTypeNotImplementedError) {
      return NextResponse.json(
        { error: err.message, implementedGenerationTypes: IMPLEMENTED_GENERATION_TYPES },
        { status: 501 }
      );
    }
    const detail = extractErrorDetail(err);
    const supabaseDebug = { projectRef: getSupabaseProjectRef(), table: TABLE_NAME };
    console.error("[neumos-ai] v1/contents generation failed", { ...detail, supabaseDebug });
    return NextResponse.json(
      { error: "generation failed", errorDetail: { ...detail, supabaseDebug } },
      { status: 500 }
    );
  }
}
