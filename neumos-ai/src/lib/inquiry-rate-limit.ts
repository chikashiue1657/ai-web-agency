import { getSupabaseAdmin } from "@/lib/supabase/server";

const WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 5;

/**
 * サーバーレス環境ではプロセスローカルなインメモリ状態はインスタンス間で
 * 共有されないため、Postgres側の原子的UPSERT関数（inquiry_rate_limit_hit、
 * supabase/schema.sql参照）で複数インスタンスをまたいで正確に制限する。
 *
 * RPC呼び出し自体が失敗した場合は、警告を出して通す（fail-open）のではなく
 * 呼び出し側で503にできるよう例外を投げる（fail-closed）。レート制限は
 * 濫用防止の主要な防御線の1つであり、判定できないなら通さない。
 */
export class RateLimitCheckFailedError extends Error {
  constructor(cause?: unknown) {
    super("Failed to evaluate the inquiry rate limit");
    this.name = "RateLimitCheckFailedError";
    if (cause !== undefined) this.cause = cause;
  }
}

export async function isInquiryRateLimited(key: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new RateLimitCheckFailedError("supabase not configured");

  const { data, error } = await admin.rpc("inquiry_rate_limit_hit", {
    p_key: key,
    p_window_seconds: WINDOW_SECONDS,
    p_max: MAX_REQUESTS,
  });
  if (error) throw new RateLimitCheckFailedError(error);
  return Boolean(data);
}
