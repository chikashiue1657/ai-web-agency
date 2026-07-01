/**
 * プロバイダ非依存の LLM クライアント（オプショナル）。
 *
 * - 既定プロバイダは Anthropic Claude。`LLM_PROVIDER=openai` で切替可能。
 * - APIキー未設定時は `isLlmAvailable() === false` を返し、呼び出し側は
 *   ルールベースの戦略・文章生成にフォールバックする（LLMなしでも完全動作）。
 * - 失敗時は例外を投げず null を返す。
 */
type Provider = "anthropic" | "openai";

function getProvider(): Provider {
  return (process.env.LLM_PROVIDER as Provider) || "anthropic";
}

export function isLlmAvailable(): boolean {
  const provider = getProvider();
  if (provider === "openai") return !!process.env.OPENAI_API_KEY;
  return !!process.env.ANTHROPIC_API_KEY;
}

interface CompleteOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function complete(opts: CompleteOptions): Promise<string | null> {
  if (!isLlmAvailable()) return null;
  const provider = getProvider();
  try {
    if (provider === "openai") return await completeOpenAI(opts);
    return await completeAnthropic(opts);
  } catch (err) {
    console.warn("[neumos-ai] LLM completion failed; falling back to rule-based", {
      provider,
      error: String(err),
    });
    return null;
  }
}

/** JSON補完。プロンプトでJSONを強制し、パースして返す。失敗時は null。 */
export async function completeJson<T = unknown>(opts: CompleteOptions): Promise<T | null> {
  const text = await complete({
    ...opts,
    system:
      (opts.system ? opts.system + "\n\n" : "") +
      "あなたは厳密なJSONのみを返すAPIです。前後に説明文やコードフェンスを付けず、有効なJSONオブジェクトだけを返してください。",
  });
  if (!text) return null;
  const parsed = safeParseJson<T>(text);
  if (!parsed) {
    console.warn("[neumos-ai] LLM returned non-JSON; falling back", { sample: text.slice(0, 200) });
  }
  return parsed;
}

function safeParseJson<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ------------------------------------------------------------
// Anthropic (Claude) - REST直叩き（SDK依存を避け軽量に保つ）
// ------------------------------------------------------------
async function completeAnthropic(opts: CompleteOptions): Promise<string | null> {
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.4,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return json.content?.map((c) => c.text ?? "").join("") ?? null;
}

// ------------------------------------------------------------
// OpenAI - Chat Completions（将来切替用）
// ------------------------------------------------------------
async function completeOpenAI(opts: CompleteOptions): Promise<string | null> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.4,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content: opts.prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? null;
}
