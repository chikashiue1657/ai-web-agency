/**
 * 診断トークン単位の、ベストエフォートなレート制限。
 *
 * 注意: Vercelのサーバーレス関数はリクエストごとに同一インスタンスが再利用される
 * 保証がないため、この実装は正式なレート制限の代替にはならない
 * （複数インスタンスに分散されれば制限をすり抜けられる）。あくまで同一インスタンスへの
 * 短時間連打に対する軽い抑止として置いている。本番での確実な制限は
 * Vercel Firewall / Rate Limitingルールを別途設定すること（PR説明を参照）。
 *
 * トークンの生値をメモリへ保持し続けないよう、ハッシュ化した値のみをキーに使う。
 */
import { createHash } from "crypto";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const hitsByTokenHash = new Map<string, number[]>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isRateLimited(token: string): boolean {
  const key = hashToken(token);
  const now = Date.now();
  const recent = (hitsByTokenHash.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hitsByTokenHash.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}
