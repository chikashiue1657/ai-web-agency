/**
 * Brand Directorのログ出力から機密情報を除外するための小さなユーティリティ。
 * APIキー・Authorizationヘッダー・レスポンス全文はログに出さない
 * （出してよいのは種別・件数・成否・所要時間程度）。
 */
export function redactErrorForLog(err: unknown): { errorType: string; message: string } {
  if (err instanceof Error) {
    return { errorType: err.name, message: err.message.slice(0, 200) };
  }
  return { errorType: "unknown", message: String(err).slice(0, 200) };
}

/** fetchのレスポンスをログへ出す際、本文は長さのみに丸める（内容そのものは出さない）。 */
export function summarizeResponseForLog(status: number, bodyLength: number) {
  return { status, bodyLength };
}
