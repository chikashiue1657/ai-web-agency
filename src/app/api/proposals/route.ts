/**
 * POST /api/proposals
 * 営業提案書生成API（テンプレ → 任意でLLM磨き → proposals保存）。
 *
 * body: { store_id: string, use_llm?: boolean, review_summary?: string, target_audience?: string }
 */
import { handler, ok, parseBody, ProposalSchema } from "@/lib/api";
import { generateProposal } from "@/lib/services";

export const POST = handler(async (req) => {
  const body = await parseBody(req, ProposalSchema);
  const proposal = await generateProposal(body.store_id, {
    useLlm: body.use_llm,
    review_summary: body.review_summary,
    target_audience: body.target_audience,
  });
  return ok({ proposal }, 201);
});
