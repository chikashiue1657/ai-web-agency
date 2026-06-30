/**
 * 優先度判定のLLM二次補正。
 * - ルールベース結果を入力に、定性情報(概要/口コミ要約)を加味して微調整。
 * - LLM未設定/失敗時は入力結果をそのまま返す（完全フォールバック）。
 * - 説明可能性のため、補正理由を reasons に追記する。
 */
import { completeJson, isLlmAvailable } from "@/lib/llm/client";
import type { ScoringInput, ScoringResult, LlmScoreAdjustment } from "./index";

const SYSTEM = `あなたは沖縄エリアの店舗向けAI集客支援会社の営業アナリストです。
ルールベースで算出した優先度スコアを、定性情報をもとに控えめに補正します。
重要原則:
- 実在しない事実を作らない。不明な点は推測せず risk_flags に「要確認」として記す。
- score_delta は -20〜+20 の範囲に収める。
- 出力は指定スキーマのJSONのみ。`;

export async function adjustScoreWithLlm(
  input: ScoringInput,
  ruleResult: ScoringResult
): Promise<ScoringResult> {
  if (!isLlmAvailable()) return ruleResult;

  const prompt = `# 店舗シグナル
業種: ${input.category ?? "不明"}
評価: ${input.rating ?? "不明"} / 口コミ数: ${input.review_count ?? "不明"}
写真数: ${input.photo_count ?? "不明"} / HP有無: ${input.has_website ? "あり" : "なし"}
SNS: ${input.instagram_url || input.facebook_url ? "あり" : "未確認"}
エリア: ${input.area ?? "不明"}
店舗概要: ${input.description ?? "（情報なし）"}
口コミ要約: ${input.review_summary ?? "（情報なし）"}

# ルールベース判定（一次）
rank=${ruleResult.priority_rank}, score=${ruleResult.score}
reasons=${JSON.stringify(ruleResult.reasons)}

# 指示
上記を踏まえ、必要なら控えめに補正してください。出力スキーマ:
{
  "score_delta": number,
  "add_reasons": string[],
  "add_risk_flags": string[],
  "sales_angle": string
}`;

  const adj = await completeJson<LlmScoreAdjustment>({
    system: SYSTEM,
    prompt,
    maxTokens: 700,
    temperature: 0.2,
  });

  if (!adj) return ruleResult; // 失敗時フォールバック

  const delta = clampDelta(adj.score_delta);
  const score = Math.min(100, Math.max(0, ruleResult.score + delta));
  const priority_rank =
    score >= 70 ? "A" : score >= 45 ? "B" : "C";

  return {
    priority_rank,
    score,
    reasons: [
      ...ruleResult.reasons,
      ...(adj.add_reasons ?? []).map((r) => `【LLM補正】${r}`),
      ...(delta !== 0 ? [`【LLM補正】スコア調整 ${delta > 0 ? "+" : ""}${delta}`] : []),
    ],
    sales_angle: adj.sales_angle?.trim() || ruleResult.sales_angle,
    risk_flags: [...ruleResult.risk_flags, ...(adj.add_risk_flags ?? [])],
    method: "rule+llm",
  };
}

function clampDelta(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.min(20, Math.max(-20, Math.round(n)));
}
