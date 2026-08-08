/**
 * 公開問い合わせAPIの送信元IP解決。
 *
 * Vercel直結構成（前段に別プロキシ/CDNを挟まない構成）では、Vercelのエッジが
 * `x-forwarded-for`を上書きし、外部から送られた値をそのまま転送しない。
 * そのため通常運用ではクライアントによる単純な先頭値詐称は防がれるが、
 * 将来前段に別プロキシを追加した場合にも耐えられるよう、Vercel独自の
 * `x-vercel-forwarded-for`を優先候補とする。
 *
 * 候補は順に x-vercel-forwarded-for → x-forwarded-for → x-real-ip。
 * 各候補についてカンマ区切りの最左（元クライアント）をtrimし、空文字・
 * 空白のみの場合は次の候補へ進む（ヘッダーが存在するが値が空、というケースを
 * 「有効な値あり」と誤認しない）。末尾を信頼する変更は行わない。
 *
 * 重要: この関数の戻り値（生のIPアドレス）は、呼び出し側でログへ出力しては
 * いけない。保存・比較にはHMACハッシュ（`hashIp`/`computeRateLimitBucketKey`）を
 * 経由すること。
 */
const CANDIDATE_HEADERS = ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"] as const;

export function resolveClientIp(request: { headers: { get(name: string): string | null } }): string {
  for (const headerName of CANDIDATE_HEADERS) {
    const raw = request.headers.get(headerName);
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
