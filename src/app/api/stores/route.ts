/**
 * GET /api/stores
 * 店舗一覧取得API（フィルタ/ソート対応）。クエリパラメータ:
 *   q, category, area, priority(A|B|C), has_website(true|false), status, sort
 */
import { handler, ok } from "@/lib/api";
import { getRepo } from "@/lib/repo";
import type { StoreListFilters } from "@/lib/repo";
import type { PriorityRank, LeadStatus } from "@/lib/types";

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const p = url.searchParams;
  const hasWebsiteRaw = p.get("has_website");

  const filters: StoreListFilters = {
    q: p.get("q") ?? undefined,
    category: p.get("category") ?? undefined,
    area: p.get("area") ?? undefined,
    priority: (p.get("priority") as PriorityRank) ?? undefined,
    hasWebsite: hasWebsiteRaw == null ? undefined : hasWebsiteRaw === "true",
    status: (p.get("status") as LeadStatus) ?? undefined,
    sort: (p.get("sort") as StoreListFilters["sort"]) ?? undefined,
  };
  const stores = await getRepo().listStores(filters);
  return ok({ count: stores.length, stores });
});
