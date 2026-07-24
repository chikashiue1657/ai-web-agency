/**
 * generationType = "website" のオーケストレーション。
 *
 * 1. ルールベースでマーケティング戦略（強み/課題/ターゲット/コンセプト）を組み立てる。
 * 2. LLMが利用可能なら、その戦略を下敷きに文章の質を高めた完全なJSONを生成させる。
 * 3. LLMが未設定・失敗・不正なJSONを返した場合は、ルールベースの結果をそのまま採用する
 *    （LLM無しでも「戦略を考えたうえでの生成」が完全に成立する）。
 */
import type { GeneratedWebsiteContents, GenerationMethod, StoreBrief } from "@/lib/types";
import { GeneratedWebsiteContentsSchema } from "@/lib/validation";
import { analyzeStrategy, generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { buildWebsitePrompt, WEBSITE_SYSTEM_PROMPT } from "@/lib/engine/prompts";
import { completeJson, isLlmAvailable } from "@/lib/llm/client";
import { clampGeneratedContents, sanitizeBrief } from "@/lib/engine/copy-limits";

export interface WebsiteGenerationResult {
  contents: GeneratedWebsiteContents;
  method: GenerationMethod;
}

export async function generateWebsiteContents(rawBrief: StoreBrief): Promise<WebsiteGenerationResult> {
  // brief中の自由記述に社内向けの括弧書きメモ等が含まれることがあるため、
  // ルールベース・LLMどちらの経路でも、まずsanitize済みのbriefだけを使う。
  const brief = sanitizeBrief(rawBrief);

  // ルールベース側は生成時点で文字数上限を守るが、LLMは目安文字数を超えて
  // 出力することがあるため、どちらの経路でも最終的に同じ上限で正規化する。
  const ruleBased = clampGeneratedContents(generateWebsiteRuleBased(brief));

  if (!isLlmAvailable()) {
    return { contents: ruleBased, method: "rule" };
  }

  const strategy = analyzeStrategy(brief);
  const prompt = buildWebsitePrompt(brief, strategy);
  const llmResult = await completeJson<unknown>({
    system: WEBSITE_SYSTEM_PROMPT,
    prompt,
    maxTokens: 3000,
  });

  if (!llmResult) {
    return { contents: ruleBased, method: "rule" };
  }

  const parsed = GeneratedWebsiteContentsSchema.safeParse(llmResult);
  if (!parsed.success) {
    console.warn("[neumos-ai] LLM website contents failed schema validation; using rule-based result", {
      issues: parsed.error.issues.slice(0, 5),
    });
    return { contents: ruleBased, method: "rule" };
  }

  return { contents: clampGeneratedContents(parsed.data), method: "rule+llm" };
}
