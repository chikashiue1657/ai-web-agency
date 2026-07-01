/**
 * POST /api/places/search
 * Google Places API (New) でキーワード検索し、正規化してstoresへupsert。
 * place_id重複は新規保存せず既存を更新する（重複行を作らない）。
 *
 * body: { query: string, max_results?: number }
 */
import { handler, ok, parseBody, PlacesSearchSchema } from "@/lib/api";
import { searchAndIngestPlaces } from "@/lib/services";

export const POST = handler(async (req) => {
  const { query, max_results } = await parseBody(req, PlacesSearchSchema);
  const result = await searchAndIngestPlaces(query, { maxResults: max_results });
  return ok(result);
});
