import { createHmac } from "node:crypto";

/**
 * レート制限のバケットキー生成。生のIP・requestIdをそのまま連結してDBへ渡すと
 * `neumos_inquiry_rate_limit.bucket_key`列に生IPが残ってしまう（source_ip_hashと
 * 同じ配慮が必要）。ここでHMAC-SHA256化してから渡すことで、DBに保存されるのは
 * 固定長(64文字hex)のダイジェストのみになる。
 *
 * 区切り文字にU+001F（Unit Separator、通常の入力には出現しない制御文字）を使い、
 * `"1" + ":23" + "4"`のような曖昧な連結（異なる(ip, requestId)の組が同じ文字列に
 * なってしまうケース）を避ける。String.fromCharCode(31)で明示的に生成する
 * （ソース中に制御文字を直接埋め込まないため）。
 */
const UNIT_SEPARATOR = String.fromCharCode(31);

export function computeRateLimitBucketKey(salt: string, ip: string, requestId: string): string {
  return createHmac("sha256", salt).update(`${ip}${UNIT_SEPARATOR}${requestId}`, "utf8").digest("hex");
}
