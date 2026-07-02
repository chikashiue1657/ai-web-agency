/** セクション本文の「・」箇条書きを配列に分解する。箇条書きでなければ本文をそのまま1件として返す。 */
export function splitBulletLines(body: string): string[] {
  const lines = body
    .split("\n")
    .map((l) => l.trim().replace(/^[・\-*]\s*/, ""))
    .filter((l) => l.length > 0);
  return lines.length > 0 ? lines : [body];
}
