import { NextRequest, NextResponse } from "next/server";
import { PublicInquirySchema, InquiryStorageUnavailableError, resolveInquiryHashSalt, savePublicInquiry } from "@/lib/inquiries";
import { isInquiryRateLimited, RateLimitCheckFailedError } from "@/lib/inquiry-rate-limit";
import { computeRateLimitBucketKey } from "@/lib/inquiry-rate-limit-key";
import { sendInquiryNotification } from "@/lib/inquiry-notification";
import { readBodyWithLimit, BodyTooLargeError } from "@/lib/inquiry-body-limit";
import { resolveClientIp } from "@/lib/inquiry-ip";
import { isInquiryFeatureEnabled } from "@/lib/inquiry-flag";
import { describeErrorSafely } from "@/lib/inquiry-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 20_000;
const MIN_FORM_FILL_MS = 2_000;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE_MESSAGE = "現在お問い合わせを受け付けられません。電話など別の方法をご利用ください";

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 機能フラグ・saltの検証は、本文読取・honeypot・時間検査・レート制限RPC・
  // DB処理より前に行う。無効時／salt未設定時にこれらへ一切到達させないため。
  if (!isInquiryFeatureEnabled()) {
    return json({ error: "not found" }, 404);
  }

  // INQUIRY_HASH_SALTはここで一度だけ読み取り、以降はこの検証済みの値を
  // 引数として渡し回す（source_ip_hash用・レート制限バケットキー用の両方に
  // 同じ値を使う。処理途中でprocess.envを再読込しない）。
  const salt = resolveInquiryHashSalt();
  if (!salt) {
    console.error("[neumos-ai] INQUIRY_HASH_SALT is not configured");
    return json({ error: UNAVAILABLE_MESSAGE }, 503);
  }

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
  // DBへ保存されるのはHMACハッシュ（source_ip_hash・レート制限バケットキー）のみ。
  const ip = resolveClientIp(request);
  const bucketKey = computeRateLimitBucketKey(salt, ip, parsed.data.requestId);

  let limited: boolean;
  try {
    limited = await isInquiryRateLimited(bucketKey);
  } catch (error) {
    if (error instanceof RateLimitCheckFailedError) {
      console.error("[neumos-ai] inquiry rate limit check failed", describeErrorSafely(error));
      return json({ error: UNAVAILABLE_MESSAGE }, 503);
    }
    throw error;
  }
  if (limited) {
    return json({ error: "送信回数が多すぎます。しばらくしてからお試しください" }, 429);
  }

  try {
    const inquiry = await savePublicInquiry(parsed.data, ip, salt);
    const notification = await sendInquiryNotification(inquiry);
    if (notification === "failed") {
      console.warn("[neumos-ai] inquiry saved but notification failed", { inquiryId: inquiry.id });
    }
    return json({ ok: true, inquiryId: inquiry.id }, 201);
  } catch (error) {
    if (error instanceof InquiryStorageUnavailableError) {
      return json({ error: UNAVAILABLE_MESSAGE }, 503);
    }
    if (error instanceof Error && error.message === "generation_not_found") {
      return json({ error: "このページのお問い合わせ先を確認できませんでした" }, 404);
    }
    console.error("[neumos-ai] inquiry save failed", describeErrorSafely(error));
    return json({ error: "送信に失敗しました。時間をおいてもう一度お試しください" }, 500);
  }
}
