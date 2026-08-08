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
import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuthResult =
  | { authorized: true }
  | { authorized: false; status: 404 }
  | { authorized: false; status: 401 }
  | { authorized: false; status: 503 };

const AUTHORIZATION_PATTERN = /^Bearer (.+)$/;

// SHA-256のダイジェストは入力長に関わらず常に32バイト固定になるため、
// timingSafeEqual自体に長さの早期リターンが発生しない
// （timingSafeEqualは長さが異なるBufferを渡すと例外を投げるため、
// 生の値同士を直接比較すると入力長がタイミングから漏れうる）。
function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEquals(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

// INQUIRY_HASH_SALTは実際の利用箇所（inquiries.ts）でtrimされた値が使われる
// ため、ここでも同じ規則で正規化する。NEUMOS_API_KEYは本来の用途では
// trimしないが、再利用検知の目的（誤って同じ値を設定していないかの判定）では
// 前後の空白だけを付けた値も同一の秘密値とみなして検知すべきため、こちらも
// trimしてから比較する。ここで生値のままequalsEnvへ渡すと、空白差分だけで
// 再利用検知（503）を回避されてしまう。
function equalsEnv(secret: string, envValue: string | undefined): boolean {
  const normalized = envValue?.trim();
  return !!normalized && safeEquals(secret, normalized);
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
