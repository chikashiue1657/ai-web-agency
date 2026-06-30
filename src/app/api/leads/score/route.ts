/**
 * POST /api/leads/score
 * 優先度判定API（ルールベース → 任意でLLM補正 → leads保存）。バッチは items を分割して順次呼ぶ想定。
 *
 * body: { store_id: string, use_llm?: boolean, extra?: {...定性シグナル} }
 */
import { handler, ok, parseBody, ScoreSchema } from "@/lib/api";
import { scoreStore } from "@/lib/services";

export const POST = handler(async (req) => {
  const body = await parseBody(req, ScoreSchema);
  const { lead, result } = await scoreStore(body.store_id, {
    useLlm: body.use_llm,
    extra: body.extra ?? undefined,
  });
  return ok({ lead, scoring: result });
});
