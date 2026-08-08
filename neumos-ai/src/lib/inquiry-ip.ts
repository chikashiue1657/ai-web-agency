/**
 * 公開問い合わせAPIの送信元IP解決。
 *
 * Vercel直結構成（前段に別プロキシ/CDNを挟まない構成）では、Vercelのエッジが
 * `x-forwarded-for`を上書きし、外部から送られた値をそのまま転送しない。
 * そのため通常運用ではクライアントによる単純な先頭値詐称は防がれるが、
 * 将来前段に別プロキシを追加した場合にも耐えられるよう、Vercel独自の
 * `x-vercel-forwarded-for`を優先し、`x-forwarded-for`はフォールバックとする。
 * どちらも標準的なXFF形式（カンマ区切り、最左が元クライアント）に従う前提で
 * 最初の値を採用する（末尾を信頼する変更はしない）。
 *
 * 重要: この関数の戻り値（生のIPアドレス）は、呼び出し側でログへ出力しては
 * いけない。保存・比較にはHMACハッシュ（`hashIp`）を経由すること。
 */
export function resolveClientIp(request: { headers: { get(name: string): string | null } }): string {
  const vercelHeader = request.headers.get("x-vercel-forwarded-for");
  const standardHeader = request.headers.get("x-forwarded-for");
  const chain = vercelHeader || standardHeader;
  const first = chain?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip") || "unknown";
}
