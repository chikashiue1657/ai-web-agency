/**
 * 問い合わせ180日削除cron（GET /api/internal/inquiries/cleanup）専用のfail-closed認可。
 *
 * 環境変数名は`CRON_SECRET`固定。Vercel Cron Jobsは、この名前の環境変数が
 * 設定されている場合のみ、スケジュール実行時のリクエストへ自動的に
 * `Authorization: Bearer <CRON_SECRET>`を付与する仕様のため、この名前で統一する
 * （vercel.jsonのcrons定義はpath/scheduleのみでカスタムヘッダーを指定できず、
 * 他の名前の秘密値をこのエンドポイント向けに自動送信させる手段がない）。
 *
 * NEUMOS_API_KEY・INQUIRY_HASH_SALTとは別の認証境界のため値を使い回さない
 * （どちらか一方が漏れた場合の影響範囲を広げないため）。誤って同じ値を設定した
 * 場合は起動時チェックを持たないためリクエスト時に検知し、fail-closedで503を返す。
 *
 * 未設定時は404（ルートの存在自体を隠す。NEUMOS_API_KEY未設定時と同じ方針）。
 * トークンはAuthorizationヘッダーからのみ読む。
 */
import { timingSafeEqual } from "node:crypto";

export type CronAuthResult =
  | { authorized: true }
  | { authorized: false; status: 404 }
  | { authorized: false; status: 401 }
  | { authorized: false; status: 503 };

const AUTHORIZATION_PATTERN = /^Bearer (.+)$/;

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  const paddedLength = Math.max(bufA.length, bufB.length, 1);
  const paddedA = Buffer.alloc(paddedLength);
  const paddedB = Buffer.alloc(paddedLength);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return bufA.length === bufB.length && timingSafeEqual(paddedA, paddedB);
}

function equalsEnv(secret: string, envValue: string | undefined): boolean {
  return !!envValue && safeEquals(secret, envValue);
}

export function checkInquiryCleanupCronAuth(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return { authorized: false, status: 404 };
  }

  if (equalsEnv(expected, process.env.NEUMOS_API_KEY) || equalsEnv(expected, process.env.INQUIRY_HASH_SALT)) {
    console.error(
      "[neumos-ai] inquiry cleanup misconfigured: CRON_SECRET must not equal NEUMOS_API_KEY or INQUIRY_HASH_SALT"
    );
    return { authorized: false, status: 503 };
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(AUTHORIZATION_PATTERN);
  if (!match || !safeEquals(expected, match[1])) {
    return { authorized: false, status: 401 };
  }

  return { authorized: true };
}
