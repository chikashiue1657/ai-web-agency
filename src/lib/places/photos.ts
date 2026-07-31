/**
 * 保存可能な place ID と表示順だけで写真プロキシURLを組み立てる。
 * Google Places の写真リソース名は保存せず、表示時にAPIから再取得する。
 */
export function photoProxyUrl(placeId: string, index: number, width = 800): string {
  return `/api/places/photo?placeId=${encodeURIComponent(placeId)}&i=${index}&w=${width}`;
}
