/**
 * ノイモスAI連携クライアント。
 *
 * REST契約（neumos-ai/README.md が唯一の基準）:
 *  - 生成投入: POST {NEUMOS_API_URL}/v1/contents
 *      headers: authorization: Bearer <NEUMOS_API_KEY>
 *      body:    { generationType, brief }   // brief = NeumosBrief
 *  - 状態取得: GET  {NEUMOS_API_URL}/v1/contents/{requestId}
 *  - レスポンス: { requestId, status, previewUrl?, publishedUrl?, generatedContents?, error? }
 *
 * NEUMOS_API_URL はデプロイ先のルートオリジンのみ（パスを含めない）。
 * 失敗時は例外を投げず { status: "failed", error } を返し、error にはレスポンス本文を
 * 切り詰めずに全文格納する（UI側でそのまま表示される）。
 */
import type { NeumosBrief, ContentGenStatus, GeneratedContent } from "@/lib/types";

export interface NeumosResult {
  /** not_configured = NEUMOS_API_URL/KEY 未設定（下書き保存にフォールバック） */
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

/** ノイモスAIの状態文字列を内部 ContentGenStatus に正規化する。 */
export function normalizeNeumosStatus(raw: unknown): ContentGenStatus {
  const s = String(raw ?? "").toLowerCase();
  if (["queued", "pending", "accepted"].includes(s)) return "queued";
  if (["generating", "processing", "in_progress", "running"].includes(s)) return "generating";
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

async function callNeumos(path: string, init: RequestInit): Promise<NeumosResult> {
  const endpoint = `${(process.env.NEUMOS_API_URL as string).replace(/\/$/, "")}${path}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.NEUMOS_API_KEY as string}`,
      },
    });
  } catch (err) {
    return { status: "failed", error: `${endpoint} への接続に失敗: ${String(err)}` };
  }

  const text = await res.text();
  if (!res.ok) {
    return { status: "failed", error: `neumos ${res.status} (${endpoint}): ${text}` };
  }

  let json: NeumosApiResponse;
  try {
    json = JSON.parse(text) as NeumosApiResponse;
  } catch {
    return { status: "failed", error: `neumos ${res.status} (${endpoint}) が不正なJSONを返却: ${text}` };
  }

  return {
    status: normalizeNeumosStatus(json.status),
    requestId: json.requestId ?? json.id,
    previewUrl: json.previewUrl,
    publishedUrl: json.publishedUrl,
    generatedContents: json.generatedContents,
    error: json.error,
  };
}

/** コンテンツ生成ジョブを投入する（種別は brief.generationType）。 */
export async function submitContentGeneration(brief: NeumosBrief): Promise<NeumosResult> {
  if (!isNeumosConfigured()) return { status: "not_configured" };
  return callNeumos("/v1/contents", {
    method: "POST",
    body: JSON.stringify({ generationType: brief.generationType, brief }),
  });
}

/** 生成状況を取得する（ポーリング）。 */
export async function getContentGenerationStatus(requestId: string): Promise<NeumosResult> {
  if (!isNeumosConfigured() || !requestId) return { status: "not_configured" };
  return callNeumos(`/v1/contents/${encodeURIComponent(requestId)}`, { method: "GET" });
}
