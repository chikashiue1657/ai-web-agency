/**
 * GET /api/stores/:id
 * 店舗詳細取得API（店舗 + lead + proposals + sites + activity）。
 */
import { handler, ok, fail } from "@/lib/api";
import { getRepo } from "@/lib/repo";

export const GET = handler(async (_req, ctx) => {
  const id = ctx.params?.id;
  if (!id) return fail("bad_request", "missing id", 400);
  const detail = await getRepo().getStoreDetail(id);
  if (!detail) return fail("store_not_found", `store ${id} not found`, 404);
  return ok(detail);
});
