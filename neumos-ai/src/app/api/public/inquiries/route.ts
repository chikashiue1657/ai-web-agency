import { NextRequest, NextResponse } from "next/server";
import { PublicInquirySchema, InquiryStorageUnavailableError, InquiryHashSaltMissingError, savePublicInquiry } from "@/lib/inquiries";
import { isInquiryRateLimited, RateLimitCheckFailedError } from "@/lib/inquiry-rate-limit";
import { sendInquiryNotification } from "@/lib/inquiry-notification";
import { readBodyWithLimit, BodyTooLargeError } from "@/lib/inquiry-body-limit";
import { resolveClientIp } from "@/lib/inquiry-ip";

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Content-Lengthは自己申告のヘッダーであり信用できないため、明らかに
  // 大きい申告値を即座に弾く高速パスとしてのみ使う。実際の上限は
  // readBodyWithLimitがストリームを読み進めながら保証する（詐称・省略時も
  // 全文がメモリへバッファされる前に打ち切る）。
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return json({ error: "入力内容が長すぎます" }, 413);

  let rawBody: string;
  try {
    rawBody = await readBodyWithLimit(request.body, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json({ error: "入力内容が長すぎます" }, 413);
    return json({ error: "入力内容を読み取れませんでした" }, 400);
  }

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

  // 生のIPアドレスはこの関数呼び出しの範囲でのみ保持し、ログには出さない。
  // 保存されるのはHMACハッシュ（savePublicInquiry内）のみ。
  const ip = resolveClientIp(request);

  let limited: boolean;
  try {
    limited = await isInquiryRateLimited(`${ip}:${parsed.data.requestId}`);
  } catch (error) {
    if (error instanceof RateLimitCheckFailedError) {
      console.error("[neumos-ai] inquiry rate limit check failed", { requestId: parsed.data.requestId });
      return json({ error: "現在お問い合わせを受け付けられません。電話など別の方法をご利用ください" }, 503);
    }
    throw error;
  }
  if (limited) {
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
    if (error instanceof InquiryHashSaltMissingError) {
      console.error("[neumos-ai] INQUIRY_HASH_SALT is not configured");
      return json({ error: "現在お問い合わせを受け付けられません。電話など別の方法をご利用ください" }, 503);
    }
    if (error instanceof Error && error.message === "generation_not_found") {
      return json({ error: "このページのお問い合わせ先を確認できませんでした" }, 404);
    }
    console.error("[neumos-ai] inquiry save failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "送信に失敗しました。時間をおいてもう一度お試しください" }, 500);
  }
}
