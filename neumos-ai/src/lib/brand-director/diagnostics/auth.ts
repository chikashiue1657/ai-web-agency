/**
 * Brand Director診断ルート（/api/admin/brand-director/*）専用のfail-closed認可。
 *
 * BRAND_DIRECTOR_DIAGNOSTIC_TOKENが未設定・空文字の場合、正しそうな値を送られても
 * 常に401ではなく404を返す（ルートの存在自体を隠し、設定し忘れたままProductionへ
 * デプロイしても誤って一般公開されないようにするため）。
 * トークンはリクエストヘッダー(x-diagnostic-token)からのみ読む。query parameter・
 * bodyに含めても認証されない。
 * 比較はtimingSafeEqualを使い、長さを揃えたバッファ同士を比較することで
 * 単純な文字列比較・長さ不一致による早期リターンのタイミング差を減らす
 * （可変長シークレットの比較で完全なタイミング安全性を保証することはできないが、
 * 最小限の対策として行う）。
 */
import { timingSafeEqual } from "crypto";

const TOKEN_HEADER = "x-diagnostic-token";

export type DiagnosticAuthResult =
  | { authorized: true; token: string }
  | { authorized: false; status: 404 }
  | { authorized: false; status: 401 };

export function checkDiagnosticAuth(req: Request): DiagnosticAuthResult {
  const expected = process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN;
  if (!expected) {
    return { authorized: false, status: 404 };
  }

  const provided = req.headers.get(TOKEN_HEADER);
  if (!provided) {
    return { authorized: false, status: 401 };
  }

  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  const paddedLength = Math.max(expectedBuf.length, providedBuf.length, 1);
  const paddedExpected = Buffer.alloc(paddedLength);
  const paddedProvided = Buffer.alloc(paddedLength);
  expectedBuf.copy(paddedExpected);
  providedBuf.copy(paddedProvided);

  const lengthMatches = expectedBuf.length === providedBuf.length;
  const bytesMatch = timingSafeEqual(paddedExpected, paddedProvided);
  if (!lengthMatches || !bytesMatch) {
    return { authorized: false, status: 401 };
  }

  return { authorized: true, token: provided };
}
