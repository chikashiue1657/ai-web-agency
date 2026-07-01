/**
 * API共通ユーティリティ。
 * - Zodバリデーション、エラーハンドリング、簡易APIキー認証（後で本認証に差し替え可）。
 * - n8n等の外部からも呼びやすい素直なJSON応答に統一。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "@/lib/services";
import { logger } from "@/lib/logger";

/** 成功レスポンス */
export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** エラーレスポンス */
export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * 任意の内部APIキー認証。
 * INTERNAL_API_KEY が設定されている場合のみ x-api-key ヘッダを検証する。
 * （未設定時はMVPとして素通り。将来Supabase Authに置換しやすい形。）
 */
export function checkApiKey(req: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return true; // 未設定なら認証スキップ
  return req.headers.get("x-api-key") === expected;
}

/**
 * ハンドラを包んで共通のエラーハンドリング/認証/ロギングを提供。
 */
export function handler(
  fn: (req: Request, ctx: { params?: Record<string, string> }) => Promise<NextResponse>
) {
  return async (req: Request, ctx: { params?: Record<string, string> }) => {
    const started = Date.now();
    try {
      if (!checkApiKey(req)) return fail("unauthorized", "invalid api key", 401);
      const res = await fn(req, ctx);
      logger.info("api.ok", { method: req.method, url: req.url, ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof ServiceError) {
        logger.warn("api.service_error", { code: err.code, message: err.message });
        return fail(err.code, err.message, err.status);
      }
      if (err instanceof z.ZodError) {
        logger.warn("api.validation_error", { issues: err.issues });
        return fail("validation_error", JSON.stringify(err.issues), 422);
      }
      logger.error("api.unhandled", { error: String(err), url: req.url });
      return fail("internal_error", "internal server error", 500);
    }
  };
}

/** JSONボディをパースしてZodで検証。 */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ServiceError("invalid_json", "request body must be valid JSON", 400);
  }
  return schema.parse(raw);
}

// ------------------------------------------------------------
// Zod スキーマ（APIの入力契約）
// ------------------------------------------------------------
export const IngestSchema = z.object({
  source: z.enum(["google_places", "apify", "csv", "manual"]),
  items: z.array(z.unknown()).min(1, "items must not be empty"),
});

export const PlacesSearchSchema = z.object({
  query: z.string().min(1, "検索キーワードを入力してください"),
  max_results: z.number().int().min(1).max(20).optional(),
});

export const ScoreSchema = z.object({
  store_id: z.string().min(1),
  use_llm: z.boolean().optional(),
  // 任意の定性シグナル（観光需要/多言語/口コミ要約など）
  extra: z
    .object({
      description: z.string().nullish(),
      review_summary: z.string().nullish(),
      tourist_demand: z.boolean().nullish(),
      multilingual_need: z.boolean().nullish(),
    })
    .optional(),
});

export const ProposalSchema = z.object({
  store_id: z.string().min(1),
  use_llm: z.boolean().optional(),
  review_summary: z.string().nullish(),
  target_audience: z.string().nullish(),
});

export const SiteSchema = z.object({
  store_id: z.string().min(1),
  theme: z
    .enum([
      "washoku",
      "modern",
      "resort",
      "clean",
      "luxury",
      "natural",
      "trust",
      "standard",
    ])
    .optional(),
  language: z.string().optional(),
  review_summary: z.string().nullish(),
  menu_items: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        meta: z.string().optional(),
      })
    )
    .optional(),
});

export const NotesSchema = z.object({
  store_id: z.string().min(1),
  notes: z.string(),
});

export const StatusSchema = z.object({
  store_id: z.string().min(1),
  status: z.enum(["todo", "dm_sent", "called", "negotiating", "won", "lost"]),
  contact_method: z.string().optional(),
});
