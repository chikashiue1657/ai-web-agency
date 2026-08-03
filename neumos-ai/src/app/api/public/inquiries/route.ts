import { NextRequest, NextResponse } from "next/server";
import { PublicInquirySchema, InquiryStorageUnavailableError, savePublicInquiry } from "@/lib/inquiries";
import { isInquiryRateLimited } from "@/lib/inquiry-rate-limit";
import { sendInquiryNotification } from "@/lib/inquiry-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 20_000;
const MIN_FORM_FILL_MS = 2_000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sourceIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "入力内容が長すぎます" }, 413);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return json({ error: "入力内容を読み取れませんでした" }, 400);
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ error: "入力内容が長すぎます" }, 413);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "入力内容を確認してください" }, 400);
  }

  const parsed = PublicInquirySchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" }, 400);
  }

  const elapsed = Date.now() - parsed.data.startedAt;
  // Honeypotと機械的な即時送信には成功風レスポンスを返し、回避条件を公開しない。
  if (parsed.data.website || elapsed < MIN_FORM_FILL_MS) return json({ ok: true }, 202);
  if (elapsed > MAX_FORM_AGE_MS) return json({ error: "ページを更新して、もう一度お試しください" }, 400);

  const ip = sourceIp(request);
  if (isInquiryRateLimited(`${ip}:${parsed.data.requestId}`)) {
    return json({ error: "送信回数が多すぎます。しばらくしてからお試しください" }, 429);
  }

  try {
    const inquiry = await savePublicInquiry(parsed.data, ip);
    const notification = await sendInquiryNotification(inquiry);
    if (notification === "failed") {
      console.warn("[neumos-ai] inquiry saved but notification failed", { inquiryId: inquiry.id });
    }
    return json({ ok: true, inquiryId: inquiry.id }, 201);
  } catch (error) {
    if (error instanceof InquiryStorageUnavailableError) {
      return json({ error: "現在お問い合わせを受け付けられません。電話など別の方法をご利用ください" }, 503);
    }
    if (error instanceof Error && error.message === "generation_not_found") {
      return json({ error: "このページのお問い合わせ先を確認できませんでした" }, 404);
    }
    console.error("[neumos-ai] inquiry save failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "送信に失敗しました。時間をおいてもう一度お試しください" }, 500);
  }
}
