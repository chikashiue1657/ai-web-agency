import { NextRequest, NextResponse } from "next/server";
import { GenerateRequestSchema } from "@/lib/validation";
import { GenerationTypeNotImplementedError } from "@/lib/engine";
import { performGeneration } from "@/lib/generate";
import { toLegacyGeneratedContents } from "@/lib/bridge";
import { IMPLEMENTED_GENERATION_TYPES } from "@/lib/types";

/**
 * POST /api/v1/contents — AI集客支援MVPの `NEUMOS_API_URL` 連携用エンドポイント。
 * MVP側 `src/lib/neumos/client.ts` の想定契約
 *   POST {BASE}/v1/contents  body: { generationType, brief }
 *   resp: { requestId, status, previewUrl?, publishedUrl?, generatedContents? }
 * にそのまま対応する。`generatedContents` はMVPの `GeneratedContent[]`
 * （`{type,title,url,body,meta}`）形式に変換して返す。
 */
export async function POST(req: NextRequest) {
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
    console.error("[neumos-ai] v1/contents generation failed", err);
    return NextResponse.json({ error: "generation failed" }, { status: 500 });
  }
}
