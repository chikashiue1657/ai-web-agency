/**
 * 対象OpenAIアカウントで、Brand Directorが使うモデルIDが実際に利用可能かを
 * 公式の GET /v1/models で確認する診断用ユーティリティ。
 *
 * 通常のBrand Director実行経路（openai-provider.ts）とは無関係。
 * ここで確認できるのは「一覧に含まれるか」の真偽値のみで、モデル一覧全文や
 * APIキー・レスポンス全文はどの呼び出し元にも返さない。
 */
import { redactErrorForLog } from "../redact";

const MODELS_URL = "https://api.openai.com/v1/models";

/** Brand Directorの推奨モデルとして.env.exampleに記載している値と揃える。 */
export const DIAGNOSTIC_TARGET_MODELS = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"] as const;

export type ModelAvailabilityResult =
  | { ok: true; available: Record<(typeof DIAGNOSTIC_TARGET_MODELS)[number], boolean> }
  | { ok: false; errorType: string; message: string };

function getTimeoutMs(): number {
  return Number(process.env.OPENAI_TIMEOUT_MS) || 8000;
}

export async function checkModelAvailability(): Promise<ModelAvailabilityResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, errorType: "config", message: "OPENAI_API_KEY not configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeoutMs());
  try {
    const res = await fetch(MODELS_URL, {
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, errorType: "http_error", message: `openai models api returned ${res.status}` };
    }

    const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
    const availableIds = new Set(
      (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string")
    );

    const available = {} as Record<(typeof DIAGNOSTIC_TARGET_MODELS)[number], boolean>;
    for (const target of DIAGNOSTIC_TARGET_MODELS) {
      available[target] = availableIds.has(target);
    }
    return { ok: true, available };
  } catch (err) {
    const reason = redactErrorForLog(err);
    return { ok: false, errorType: reason.errorType, message: reason.message };
  } finally {
    clearTimeout(timer);
  }
}
