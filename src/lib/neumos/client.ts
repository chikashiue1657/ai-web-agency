/**
 * ノイモスAI（店舗のWeb集客コンテンツ生成AI）連携クライアント（実接続）。
 *
 * 設計:
 *  - 生成エンジンを疎結合にするための境界。ここが唯一の外部依存。
 *  - 環境変数(NEUMOS_API_URL / NEUMOS_API_KEY)が無ければ "not_configured" を返し、
 *    UI/業務ロジックは壊れずに「未接続（JSONプレビュー）」として扱える。
 *
 * 想定するノイモスAI REST契約（本仕様確定時にここだけ調整）:
 *  - 生成投入: POST {BASE}/v1/contents
 *      headers: authorization: Bearer <KEY>, content-type: application/json
 *      body:    { generationType, brief }          // brief = NeumosBrief
 *      resp:    { requestId, status, previewUrl?, publishedUrl?, generatedContents? }
 *  - 状態取得: GET {BASE}/v1/contents/{requestId}
 *      resp:    { requestId, status, previewUrl?, publishedUrl?, generatedContents?, error? }
 *    status は queued|generating|preview|published|failed を想定（別表記は正規化）。
 */
import type {
  NeumosBrief,
  ContentGenStatus,
  GeneratedContent,
} from "@/lib/types";
import { logger } from "@/lib/logger";

export interface NeumosResult {
  /** not_configured = 未接続（NeumosBrief のJSONプレビュー用途） */
  status: ContentGenStatus | "not_configured";
  requestId?: string;
  previewUrl?: string;
  publishedUrl?: string;
  generatedContents?: GeneratedContent[];
  error?: string;
}

export function isNeumosConfigured(): boolean {
  return !!process.env.NEUMOS_API_URL && !!process.env.NEUMOS_API_KEY;
}

function base(): string {
  return (process.env.NEUMOS_API_URL as string).replace(/\/$/, "");
}

function authHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${process.env.NEUMOS_API_KEY as string}`,
  };
}

/** ノイモスAIの状態文字列を内部 ContentGenStatus に正規化する。 */
export function normalizeNeumosStatus(raw: unknown): ContentGenStatus {
  const s = String(raw ?? "").toLowerCase();
  if (["queued", "pending", "accepted"].includes(s)) return "queued";
  if (["generating", "processing", "in_progress", "running"].includes(s))
    return "generating";
  if (["preview", "ready", "completed", "done"].includes(s)) return "preview";
  if (["published", "live"].includes(s)) return "published";
  if (["failed", "error"].includes(s)) return "failed";
  return "queued";
}

interface NeumosApiResponse {
  requestId?: string;
  id?: string;
  status?: string;
  previewUrl?: string;
  publishedUrl?: string;
  generatedContents?: GeneratedContent[];
  error?: string;
}

function mapResponse(json: NeumosApiResponse): NeumosResult {
  return {
    status: normalizeNeumosStatus(json.status),
    requestId: json.requestId ?? json.id,
    previewUrl: json.previewUrl,
    publishedUrl: json.publishedUrl,
    generatedContents: json.generatedContents,
    error: json.error,
  };
}

/**
 * コンテンツ生成ジョブを投入する（種別は brief.generationType）。
 * - 未接続時は { status: "not_configured" }（例外を投げない）。
 */
export async function submitContentGeneration(brief: NeumosBrief): Promise<NeumosResult> {
  if (!isNeumosConfigured()) return { status: "not_configured" };

  try {
    const res = await fetch(`${base()}/v1/contents`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ generationType: brief.generationType, brief }),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.warn("neumos submit failed", { status: res.status, detail: detail.slice(0, 300) });
      return { status: "failed", error: `neumos ${res.status}: ${detail.slice(0, 200)}` };
    }
    return mapResponse((await res.json()) as NeumosApiResponse);
  } catch (err) {
    logger.error("neumos submit error", { error: String(err) });
    return { status: "failed", error: String(err) };
  }
}

/**
 * 生成状況を取得する（ポーリング）。
 * - 未接続 / requestId 無しは "not_configured"。
 */
export async function getContentGenerationStatus(requestId: string): Promise<NeumosResult> {
  if (!isNeumosConfigured()) return { status: "not_configured" };
  if (!requestId) return { status: "not_configured" };

  try {
    const res = await fetch(`${base()}/v1/contents/${encodeURIComponent(requestId)}`, {
      method: "GET",
      headers: authHeaders(),
    });
    if (!res.ok) {
      const detail = await res.text();
      logger.warn("neumos status failed", { status: res.status, detail: detail.slice(0, 300) });
      return { status: "failed", error: `neumos ${res.status}` };
    }
    return mapResponse((await res.json()) as NeumosApiResponse);
  } catch (err) {
    logger.error("neumos status error", { error: String(err) });
    return { status: "failed", error: String(err) };
  }
}

/** @deprecated 旧名。submitContentGeneration を使用。 */
export const submitSiteGeneration = submitContentGeneration;
