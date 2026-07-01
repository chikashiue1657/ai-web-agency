/**
 * アウトリーチ文面のLLM磨き込み（任意）。
 * - ルールベースの下書きを、チャネルに合った自然な日本語に整える。
 * - 事実の追加・捏造は禁止。与えた情報の範囲で表現のみ改善。
 * - LLM未設定/失敗時は下書きをそのまま返す。
 */
import { complete, isLlmAvailable } from "@/lib/llm/client";
import { OUTREACH_LABEL, type OutreachChannel } from "./index";

const TONE: Record<OutreachChannel, string> = {
  email: "丁寧でビジネスライク。簡潔に。",
  instagram_dm: "フレンドリーで短め。絵文字は控えめに自然に。",
  phone_script: "話し言葉。テンポよく、間の取り方が分かる構成を保つ。",
};

export async function refineOutreachWithLlm(
  channel: OutreachChannel,
  draft: string,
  storeName: string
): Promise<string> {
  if (!isLlmAvailable()) return draft;

  const system = `あなたは沖縄の店舗向けAI集客支援会社の営業ライターです。
与えられた${OUTREACH_LABEL[channel]}の下書きを、より自然で成果の出やすい文面に整えます。
厳守事項:
- 与えられた情報以外の事実（数値・実績・固有名詞）を新たに作らない。
- 「（仮説）」等の不確実表現は保持する。誇大表現を避ける。
- トーン: ${TONE[channel]}
- 構造（件名/見出し/切り返し等）は保つ。`;

  const refined = await complete({
    system,
    prompt: `店舗名: ${storeName}\n\n以下を磨いてください。本文のみ返す。\n---\n${draft}`,
    maxTokens: 1200,
    temperature: 0.5,
  });

  return refined && refined.trim().length > 20 ? refined.trim() : draft;
}
