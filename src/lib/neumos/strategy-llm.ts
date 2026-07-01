/**
 * Thinking Engine のLLM二次補正（任意）。
 * - ルールベースの StoreStrategy を、定性情報を加味して自然な日本語に磨く。
 * - 事実の追加・捏造は禁止。与えた範囲で表現改善と観点補強のみ。
 * - LLM未設定/失敗時はルールベース結果をそのまま返す（完全フォールバック）。
 */
import { completeJson, isLlmAvailable } from "@/lib/llm/client";
import type { StoreStrategy } from "@/lib/types";

const SYSTEM = `あなたは沖縄の店舗向けAI集客支援会社の戦略アナリストです。
ルールベースの店舗診断を、定性情報をもとに控えめに磨きます。
厳守:
- 実在しない事実（数値・実績）を作らない。不明は「（仮説）」を保持。
- 出力は指定スキーマのJSONのみ。各配列は最大5件。`;

interface StrategyAdjustment {
  differentiation?: string;
  salesAngle?: string;
  recommendedOffer?: string;
  websiteConcept?: string;
  add_strengths?: string[];
  add_marketingProblems?: string[];
  confidence_delta?: number; // -15〜+15
}

export async function enrichStrategyWithLlm(
  strategy: StoreStrategy,
  ctx: { reviewSummary?: string | null }
): Promise<StoreStrategy> {
  if (!isLlmAvailable()) return strategy;

  const prompt = `# 店舗診断（ルールベース一次）
業種/ターゲット: ${strategy.generationBrief.industry} / ${strategy.targetCustomer}
強み: ${JSON.stringify(strategy.strengths)}
弱み: ${JSON.stringify(strategy.weaknesses)}
集客課題: ${JSON.stringify(strategy.marketingProblems)}
営業切り口: ${strategy.salesAngle}
受注確率: ${strategy.confidenceScore}
口コミ要約: ${ctx.reviewSummary ?? "（なし）"}

# 指示
必要なら控えめに補正し、次のJSONのみ返す:
{
  "differentiation": string,
  "salesAngle": string,
  "recommendedOffer": string,
  "websiteConcept": string,
  "add_strengths": string[],
  "add_marketingProblems": string[],
  "confidence_delta": number
}`;

  const adj = await completeJson<StrategyAdjustment>({
    system: SYSTEM,
    prompt,
    maxTokens: 800,
    temperature: 0.3,
  });
  if (!adj) return strategy;

  const delta = clamp(adj.confidence_delta, -15, 15);
  const confidenceScore = Math.max(0, Math.min(100, strategy.confidenceScore + delta));

  return {
    ...strategy,
    differentiation: adj.differentiation?.trim() || strategy.differentiation,
    salesAngle: adj.salesAngle?.trim() || strategy.salesAngle,
    recommendedOffer: adj.recommendedOffer?.trim() || strategy.recommendedOffer,
    websiteConcept: adj.websiteConcept?.trim() || strategy.websiteConcept,
    strengths: dedupe([...strategy.strengths, ...(adj.add_strengths ?? [])]).slice(0, 8),
    marketingProblems: dedupe([
      ...strategy.marketingProblems,
      ...(adj.add_marketingProblems ?? []),
    ]).slice(0, 8),
    confidenceScore,
    // generationBrief も磨いた表現に追随させる
    generationBrief: {
      ...strategy.generationBrief,
      salesAngle: adj.salesAngle?.trim() || strategy.generationBrief.salesAngle,
      siteConcept: adj.websiteConcept?.trim() || strategy.generationBrief.siteConcept,
      offer: adj.recommendedOffer?.trim() || strategy.generationBrief.offer,
    },
    method: "rule+llm",
  };
}

function clamp(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}
