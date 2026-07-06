/**
 * API Route失敗時に、例外の生の情報をそのままレスポンス/ログへ出すための共通ヘルパー。
 * 値を要約・推測せず、Supabase(PostgrestError)のcode/details/hintを含め、
 * 存在するプロパティだけを拾う（無いものは作らない）。
 * これにより「generation failed」のような詳細の無いメッセージのみを返すことを避ける。
 */
export interface ErrorDetail {
  name?: string;
  message?: string;
  /** Postgrest/Postgresのエラーコード（例: 42P01 = relation does not exist, PGRST205 = table not found in schema cache）。 */
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
}

export function extractErrorDetail(err: unknown): ErrorDetail {
  if (err instanceof Error) {
    const withPg = err as Error & { code?: unknown; details?: unknown; hint?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: typeof withPg.code === "string" ? withPg.code : undefined,
      details: typeof withPg.details === "string" ? withPg.details : undefined,
      hint: typeof withPg.hint === "string" ? withPg.hint : undefined,
      stack: err.stack,
    };
  }
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return {
      message: typeof obj.message === "string" ? obj.message : String(err),
      code: typeof obj.code === "string" ? obj.code : undefined,
      details: typeof obj.details === "string" ? obj.details : undefined,
      hint: typeof obj.hint === "string" ? obj.hint : undefined,
    };
  }
  return { message: String(err) };
}
