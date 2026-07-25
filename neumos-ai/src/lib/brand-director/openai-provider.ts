/**
 * Brand DirectorのOpenAI実装（Responses API + Structured Outputs strict mode）。
 *
 * 既存 llm/client.ts と同じ方針で、SDKを追加せず fetch 直叩きにしている。
 * 失敗・タイムアウト・スキーマ不一致は例外を投げず、必ずrule-providerへ
 * フォールバックする（既存生成を止めないため）。ログにはAPIキー・
 * レスポンス全文を出さない（redact.ts経由のみ）。
 *
 * 注意: Responses APIのリクエスト/レスポンス形状（input/text.format/output_text等）は
 * 現時点のOpenAI公式ドキュメントに基づく実装だが、このサンドボックス環境は
 * api.openai.comへの外向き通信が許可されておらず実APIでの検証ができていない
 * （OPENAI_API_KEYも未設定）。Phase2で実際にネットワーク到達可能な環境から
 * 一度実接続し、リクエスト形状を確認・必要なら調整すること。
 * 形状が想定と異なっていても、失敗時は必ずrule-providerへ安全にフォールバック
 * するため、既存の生成経路が壊れることはない。
 */
import { BRAND_PLAN_JSON_SCHEMA, PHOTO_ANALYSIS_JSON_SCHEMA, BrandPlanSchema, PhotoAnalysisSchema } from "./schema";
import type { BrandDirectionProvider } from "./provider";
import type { BrandDirectionInput, BrandDirectionResult, PhotoAnalysis } from "./types";
import { redactErrorForLog } from "./redact";
import { ruleBrandDirectionProvider } from "./rule-provider";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_RETRIES = 1;

type ModelTier = "standard" | "premium" | "vision";

/** モデルIDはコードへ直書きせず、env varから解決する（Phase4）。 */
function resolveModel(tier: ModelTier): string {
  const standard = process.env.OPENAI_MODEL_STANDARD?.trim();
  const premium = process.env.OPENAI_MODEL_PREMIUM?.trim();
  const vision = process.env.OPENAI_MODEL_VISION?.trim();
  const fallback = standard || "gpt-4o-mini";
  if (tier === "premium") return premium || fallback;
  if (tier === "vision") return vision || fallback;
  return fallback;
}

/**
 * 呼び出しのたびに読む（モジュール読み込み時点の値をトップレベル定数として
 * 固定すると、テストや将来のランタイム設定変更でenv varを書き換えても
 * 反映されない実バグになる — 実際にテストで発見した）。
 */
function getTimeoutMs(): number {
  return Number(process.env.OPENAI_TIMEOUT_MS) || 8000;
}

async function callResponsesApi(body: unknown, timeoutMs = getTimeoutMs()): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`openai responses api returned ${res.status}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/** SDK無しの直叩きのため、Responses APIの出力形状の揺れに強い、緩やかな探索で本文テキストを取り出す。 */
function extractOutputText(response: unknown): string | null {
  const r = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };
  if (typeof r?.output_text === "string") return r.output_text;
  if (Array.isArray(r?.output)) {
    for (const item of r.output) {
      if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (typeof c?.text === "string") return c.text;
        }
      }
    }
  }
  return null;
}

function extractUsage(response: unknown): { inputTokens: number | null; outputTokens: number | null } {
  const r = response as { usage?: { input_tokens?: number; output_tokens?: number } };
  return {
    inputTokens: typeof r?.usage?.input_tokens === "number" ? r.usage.input_tokens : null,
    outputTokens: typeof r?.usage?.output_tokens === "number" ? r.usage.output_tokens : null,
  };
}

const BRAND_SYSTEM_PROMPT = `あなたは店舗専用のブランド方針を決定する Brand Director です。
brief（店舗情報・AI診断結果）に実在しない事実を作らないこと。
事実（brief/realDataに書かれている内容）と推測（そこから導いた解釈）を必ず分離し、
推測にあたる判断は evidence[].basis を "inference" にすること。
confidenceは、briefの情報量が少ない・判断が難しい場合は低く申告すること
（低いconfidenceの判断を断定的な表現の理由にしないこと）。
制作会社側の施策説明（SEO・集客支援等）は一切出力しないこと。
写真の分析結果(photoAnalyses)を渡されていない場合、photoAssignmentsは空配列にすること
（写真を見ずに役割を捏造しないこと）。`;

const PHOTO_SYSTEM_PROMPT = `あなたは店舗写真1枚を分析するVisionアナリストです。
写真から読み取れる客観的な特徴だけを構造化して出力し、写っていないものを
containsPeople等でtrueにしないこと。recommendedRoleは写真の内容と構図から
妥当なものを1つだけ選ぶこと。`;

function buildBrandUserPrompt(input: BrandDirectionInput, photoAnalyses?: PhotoAnalysis[]): string {
  return JSON.stringify(
    {
      brief: input.brief,
      photoAnalyses: photoAnalyses ?? [],
    },
    null,
    2
  );
}

async function fallbackToRule(
  input: BrandDirectionInput,
  photoAnalyses: PhotoAnalysis[] | undefined,
  start: number,
  retryCount: number,
  err: unknown
): Promise<BrandDirectionResult> {
  const reason = redactErrorForLog(err);
  console.warn("[neumos-ai] brand-director openai analyzeBrand failed; falling back to rule", reason);
  const fallback = await ruleBrandDirectionProvider.analyzeBrand(input, photoAnalyses);
  return {
    plan: fallback.plan,
    usage: {
      ...fallback.usage,
      provider: "openai",
      fallbackReason: reason.message,
      retryCount,
      durationMs: Date.now() - start,
    },
  };
}

export const openaiBrandDirectionProvider: BrandDirectionProvider = {
  name: "openai",

  async analyzeBrand(input: BrandDirectionInput, photoAnalyses?: PhotoAnalysis[]): Promise<BrandDirectionResult> {
    const start = Date.now();
    const model = resolveModel("premium");

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const body = {
          model,
          store: false, // 店舗データをOpenAI側に保持させない
          input: [
            { role: "system", content: BRAND_SYSTEM_PROMPT },
            { role: "user", content: buildBrandUserPrompt(input, photoAnalyses) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: BRAND_PLAN_JSON_SCHEMA.name,
              strict: BRAND_PLAN_JSON_SCHEMA.strict,
              schema: BRAND_PLAN_JSON_SCHEMA.schema,
            },
          },
        };
        const response = await callResponsesApi(body);
        const text = extractOutputText(response);
        if (!text) throw new Error("openai response contained no output text");

        const parsed = BrandPlanSchema.safeParse(JSON.parse(text));
        if (!parsed.success) throw new Error("brand plan failed schema validation");

        const usage = extractUsage(response);
        return {
          plan: parsed.data,
          usage: {
            requestId: input.requestId,
            provider: "openai",
            model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            durationMs: Date.now() - start,
            success: true,
            fallbackReason: null,
            retryCount: attempt,
            photosAnalyzed: photoAnalyses?.length ?? 0,
            estimatedCostUsd: null,
          },
        };
      } catch (err) {
        if (attempt === MAX_RETRIES) {
          return fallbackToRule(input, photoAnalyses, start, attempt + 1, err);
        }
        console.warn("[neumos-ai] brand-director openai analyzeBrand attempt failed; retrying", redactErrorForLog(err));
      }
    }
    // 到達しない（ループは必ずreturnする）が、型を満たすための保険。
    return fallbackToRule(input, photoAnalyses, start, MAX_RETRIES + 1, new Error("unreachable"));
  },

  async analyzePhotos(photoUrls: string[], input: BrandDirectionInput): Promise<PhotoAnalysis[]> {
    if (photoUrls.length === 0) return [];
    const model = resolveModel("vision");
    const results: PhotoAnalysis[] = [];

    for (const photoUrl of photoUrls) {
      try {
        const body = {
          model,
          store: false,
          input: [
            { role: "system", content: PHOTO_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "input_text", text: `店舗: ${input.brief.storeName}（${input.brief.industry}）` },
                { type: "input_image", image_url: photoUrl },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: PHOTO_ANALYSIS_JSON_SCHEMA.name,
              strict: PHOTO_ANALYSIS_JSON_SCHEMA.strict,
              schema: PHOTO_ANALYSIS_JSON_SCHEMA.schema,
            },
          },
        };
        const response = await callResponsesApi(body);
        const text = extractOutputText(response);
        if (!text) throw new Error("openai response contained no output text");

        const parsed = PhotoAnalysisSchema.safeParse(JSON.parse(text));
        if (!parsed.success) throw new Error("photo analysis failed schema validation");
        results.push({ ...parsed.data, photoUrl });
      } catch (err) {
        console.warn(
          "[neumos-ai] brand-director openai analyzePhotos failed for one photo; marking as rejected",
          redactErrorForLog(err)
        );
        results.push({
          photoUrl,
          subject: "unknown",
          brightness: "balanced",
          orientation: "landscape",
          dominantMood: "unknown",
          containsPeople: false,
          containsFoodOrProduct: false,
          containsExterior: false,
          containsInterior: false,
          textSafeArea: "none",
          recommendedRole: "reject",
          qualityScore: 0,
          rejectionReason: "analysis_failed",
        });
      }
    }
    return results;
  },
};
