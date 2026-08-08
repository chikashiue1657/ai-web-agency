/**
 * Supabase/Postgres等のサードパーティ由来のエラーは、`message`に状況依存の
 * 内容（制約違反時の値の一部等）を含みうるため、そのままログへ出さない。
 * ログへ出してよい最小限の情報（型名・エラーコード）だけを抽出する。
 * 呼び出し側でrequestId等の識別子を別途addすること（本関数はそれを行わない）。
 */
export interface SafeErrorInfo {
  type: string;
  code?: string;
}

export function describeErrorSafely(error: unknown): SafeErrorInfo {
  if (error && typeof error === "object") {
    const name = "name" in error && typeof (error as { name?: unknown }).name === "string"
      ? (error as { name: string }).name
      : undefined;
    const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
    return { type: name || "UnknownError", code };
  }
  return { type: "UnknownError" };
}
