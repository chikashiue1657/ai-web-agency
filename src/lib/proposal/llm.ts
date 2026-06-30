/**
 * 提案書のLLM磨き込み（任意）。
 * - ルールベースで作った構造（problems/opportunities/sales_message/summary）を
 *   営業現場で使える自然な日本語に整える。
 * - 事実の追加・捏造を禁止し、与えた情報の範囲で文章化のみ行う。
 * - LLM未設定/失敗時はルールベース結果をそのまま返す。
 */
import { complete, isLlmAvailable } from "@/lib/llm/client";
import type { ProposalResult, BuildProposalInput } from "./index";

const SYSTEM = `あなたは沖縄の店舗向けAI集客支援会社の営業ライターです。
与えられた下書きを、店舗オーナーに響く自然で簡潔な日本語に整えます。
厳守事項:
- 与えられた情報以外の事実（数値・実績・固有名詞）を新たに作らない。
- 不明な点は「（仮説）」「要確認」の表現を保持する。
- 誇大表現を避け、誠実で具体的なトーンにする。
- Markdownの見出し構造は変えない。本文の表現のみ磨く。`;

/**
 * 提案書Markdownを磨く。構造化フィールドはそのまま、本文(markdown)のみ改善。
 */
export async function refineProposalWithLlm(
  base: ProposalResult,
  input: BuildProposalInput
): Promise<ProposalResult> {
  if (!isLlmAvailable()) return base;

  const prompt = `以下は「${input.store.name}」向け提案書の下書き(Markdown)です。
見出し構造を保ったまま、表現を自然で営業現場で使える品質に磨いてください。
事実の追加は禁止です。

---
${base.generated_markdown}
---

磨いたMarkdown全文のみを返してください。`;

  const refined = await complete({
    system: SYSTEM,
    prompt,
    maxTokens: 2000,
    temperature: 0.4,
  });

  if (!refined || refined.trim().length < 50) return base; // フォールバック

  return { ...base, generated_markdown: refined.trim() };
}
