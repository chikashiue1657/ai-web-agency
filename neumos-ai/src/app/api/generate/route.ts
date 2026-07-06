import { NextRequest, NextResponse } from "next/server";
import { GenerateRequestSchema } from "@/lib/validation";
import { GenerationTypeNotImplementedError } from "@/lib/engine";
import { performGeneration } from "@/lib/generate";
import { IMPLEMENTED_GENERATION_TYPES } from "@/lib/types";
import type { GenerateResponse } from "@/lib/types";
import { extractErrorDetail } from "@/lib/error-detail";

/**
 * POST /api/generate
 * 店舗情報・AI診断・営業提案(brief)を受け取り、店舗向けWeb集客コンテンツを生成する。
 * v1 は generationType = "website" のみ実装。他の種別は入力検証は通すが 501 を返す。
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

    const response: GenerateResponse = {
      requestId: record.requestId,
      status: record.status,
      previewUrl: record.previewUrl,
      publishedUrl: record.publishedUrl,
      generatedContents: record.generatedContents,
    };
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    if (err instanceof GenerationTypeNotImplementedError) {
      return NextResponse.json(
        {
          error: err.message,
          implementedGenerationTypes: IMPLEMENTED_GENERATION_TYPES,
        },
        { status: 501 }
      );
    }
    const detail = extractErrorDetail(err);
    console.error("[neumos-ai] generation failed", detail);
    return NextResponse.json({ error: "generation failed", errorDetail: detail }, { status: 500 });
  }
}
