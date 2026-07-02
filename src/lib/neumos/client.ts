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
 * 失敗時は例外を投げず { status: "failed", error } を返す。
 * error には推測を挟まず、実際に送受信したHTTPの生情報（URL/method/request body/
 * masked Authorization/response status/response headers/response body全文）を
 * JSON文字列として格納する（画面の「エラー詳細を表示」でそのまま確認できる）。
 */
import type { NeumosBrief, ContentGenStatus, GeneratedContent } from "@/lib/types";

export interface NeumosResult {
  /** not_configured = NEUMOS_API_URL/KEY 未設定（下書き保存にフォールバック） */
  status: ContentGenStatus | "not_configured";
  requestId?: string;
  previewUrl?: string;
  publishedUrl?: string;
  generatedContents?: GeneratedContent[];
  /** 失敗時のみ設定。NeumosErrorDetail をJSON.stringifyした文字列。 */
  error?: string;
}

/** 失敗時にそのまま画面へ出す生のHTTP往復情報。値を要約・推測しない。 */
export interface NeumosErrorDetail {
  requestUrl: string;
  requestMethod: string;
  requestHeaders: { authorization: string; "content-type": string };
  requestBody: unknown;
  /** fetch自体が失敗した場合（DNS/接続不可等）はレスポンスが無いためnull。 */
  responseStatus: number | null;
  responseHeaders: Record<string, string> | null;
  /** レスポンス本文の全文（切り詰めない）。fetch失敗時はnull。 */
  responseBody: string | null;
  /** fetchが例外を投げた場合のメッセージ。正常にレスポンスを受けた場合はnull。 */
  networkError: string | null;
}

export function isNeumosConfigured(): boolean {
  return !!process.env.NEUMOS_API_URL && !!process.env.NEUMOS_API_KEY;
}

/** Authorizationヘッダーの値を先頭5文字だけ残して伏字にする。 */
function maskAuthorization(): string {
  const key = process.env.NEUMOS_API_KEY ?? "";
  return `Bearer ${key.slice(0, 5)}${"*".repeat(Math.max(key.length - 5, 0))}`;
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

async function callNeumos(
  path: string,
  method: "GET" | "POST",
  requestBody?: unknown
): Promise<NeumosResult> {
  const requestUrl = `${(process.env.NEUMOS_API_URL as string).replace(/\/$/, "")}${path}`;
  const requestHeaders = { authorization: maskAuthorization(), "content-type": "application/json" };

  const detail: NeumosErrorDetail = {
    requestUrl,
    requestMethod: method,
    requestHeaders,
    requestBody: requestBody ?? null,
    responseStatus: null,
    responseHeaders: null,
    responseBody: null,
    networkError: null,
  };

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.NEUMOS_API_KEY as string}`,
      },
      ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {}),
    });
  } catch (err) {
    detail.networkError = err instanceof Error ? err.message : String(err);
    return { status: "failed", error: JSON.stringify(detail) };
  }

  detail.responseStatus = res.status;
  detail.responseHeaders = Object.fromEntries(res.headers.entries());
  detail.responseBody = await res.text();

  if (!res.ok) {
    return { status: "failed", error: JSON.stringify(detail) };
  }

  let json: NeumosApiResponse;
  try {
    json = JSON.parse(detail.responseBody) as NeumosApiResponse;
  } catch {
    return { status: "failed", error: JSON.stringify(detail) };
  }

  const status = normalizeNeumosStatus(json.status);
  // HTTPは200でもボディ上は失敗を表しているケース（status:"failed" や error付き）。
  if (status === "failed" || json.error) {
    return { status: "failed", error: JSON.stringify(detail) };
  }

  return {
    status,
    requestId: json.requestId ?? json.id,
    previewUrl: json.previewUrl,
    publishedUrl: json.publishedUrl,
    generatedContents: json.generatedContents,
  };
}

/** コンテンツ生成ジョブを投入する（種別は brief.generationType）。 */
export async function submitContentGeneration(brief: NeumosBrief): Promise<NeumosResult> {
  if (!isNeumosConfigured()) return { status: "not_configured" };
  return callNeumos("/v1/contents", "POST", { generationType: brief.generationType, brief });
}

/** 生成状況を取得する（ポーリング）。 */
export async function getContentGenerationStatus(requestId: string): Promise<NeumosResult> {
  if (!isNeumosConfigured() || !requestId) return { status: "not_configured" };
  return callNeumos(`/v1/contents/${encodeURIComponent(requestId)}`, "GET");
}
