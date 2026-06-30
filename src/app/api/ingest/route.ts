/**
 * POST /api/ingest
 * 店舗取り込みAPI（正規化 + upsert）。n8n等から呼び出しやすいシンプルなJSON契約。
 *
 * body: { source: "google_places"|"apify"|"csv"|"manual", items: unknown[] }
 */
import { handler, ok, parseBody, IngestSchema } from "@/lib/api";
import { ingestStores } from "@/lib/services";

export const POST = handler(async (req) => {
  const { source, items } = await parseBody(req, IngestSchema);
  const result = await ingestStores(source, items);
  return ok({
    inserted: result.inserted,
    updated: result.updated,
    store_ids: result.stores.map((s) => s.id),
  });
});
