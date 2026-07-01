/**
 * 保存済み raw_payload から Places 写真リソース名を取り出す純関数。
 * - Places API (New) は photos: [{ name: "places/.../photos/..." }] を返す。
 * - 取得元が異なる/写真が無い場合は空配列。
 */
export function extractPhotoNames(
  rawPayload: Record<string, unknown> | null | undefined,
  limit = 8
): string[] {
  if (!rawPayload) return [];
  const photos = (rawPayload as { photos?: unknown }).photos;
  if (!Array.isArray(photos)) return [];
  const names: string[] = [];
  for (const p of photos) {
    const name = (p as { name?: unknown })?.name;
    if (typeof name === "string" && /^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
      names.push(name);
    }
    if (names.length >= limit) break;
  }
  return names;
}

/** プロキシ経由の写真URLを組み立てる。 */
export function photoProxyUrl(name: string, width = 800): string {
  return `/api/places/photo?name=${encodeURIComponent(name)}&w=${width}`;
}
