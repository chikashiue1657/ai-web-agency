/**
 * Brand Director診断ルート（/api/admin/brand-director/*）専用の認可。
 *
 * 秘密トークン(BRAND_DIRECTOR_DIAGNOSTIC_TOKEN)必須。未設定の場合は常に拒否する
 * （設定し忘れたままProductionへデプロイしても誤って一般公開されないようにするため）。
 * トークン比較はtimingSafeEqualでタイミング攻撃を避ける。
 *
 * このファイルは診断機能専用。診断が不要になった時点で
 * src/lib/brand-director/diagnostics/ と src/app/api/admin/brand-director/ を
 * まとめて削除すれば、既存のBrand Director本体（provider.ts等）には影響しない。
 */
import { timingSafeEqual } from "crypto";

const TOKEN_HEADER = "x-diagnostic-token";

export function isDiagnosticAuthorized(req: Request): boolean {
  const expected = process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN;
  if (!expected) return false;

  const provided = req.headers.get(TOKEN_HEADER);
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
