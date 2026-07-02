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

/** ログ・診断用にAPIキーを先頭5文字だけ残してマスクする（本文は絶対に出力しない）。 */
function maskAuthHeader(headers: Record<string, string>): string {
  const raw = headers.authorization ?? "";
  const key = raw.replace(/^Bearer\s+/i, "");
  if (!key) return "(none)";
  return `Bearer ${key.slice(0, 5)}...(${key.length} chars)`;
}

/**
 * Production起動時にNEUMOS_API_URL/KEYの設定状況を1回だけログ出力する。
 * - 値そのものは出さず、設定有無・URLのホスト名のみ（トークンなど機微値を含まない）。
 */
let loggedConfigOnce = false;
function logConfigStatusOnce() {
  if (loggedConfigOnce) return;
  loggedConfigOnce = true;
  const url = process.env.NEUMOS_API_URL;
  let host: string | null = null;
  if (url) {
    try {
      host = new URL(url).host;
    } catch {
      host = "(invalid URL)";
    }
  }
  logger.info("neumos config status", {
    NEUMOS_API_URL_set: !!url,
    NEUMOS_API_URL_host: host,
    NEUMOS_API_KEY_set: !!process.env.NEUMOS_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });
  // よくある誤設定: NEUMOS_API_URLにパスを含めてしまう(例: .../api や .../v1)。
  // client.tsは常に `${NEUMOS_API_URL}/v1/contents` を組み立てるため、パスを含めると
  // 二重になり404("コンテンツ生成依頼に失敗しました")の原因になる。
  if (url) {
    try {
      const path = new URL(url).pathname;
      if (path && path !== "/") {
        logger.warn(
          "neumos config warning: NEUMOS_API_URL contains a path — it should be the deployment root origin only",
          { NEUMOS_API_URL_path: path }
        );
      }
    } catch {
      logger.warn("neumos config warning: NEUMOS_API_URL is not a valid URL", { NEUMOS_API_URL: url });
    }
  }
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
 * - 診断のため、endpoint / request body / (マスク済み)Authorization / status /
 *   response body を必ずログ出力する（`logger.info`はVercelのFunction Logsで確認可能）。
 */
export async function submitContentGeneration(brief: NeumosBrief): Promise<NeumosResult> {
  logConfigStatusOnce();
  if (!isNeumosConfigured()) {
    logger.warn("neumos submit skipped: not configured", {
      NEUMOS_API_URL_set: !!process.env.NEUMOS_API_URL,
      NEUMOS_API_KEY_set: !!process.env.NEUMOS_API_KEY,
    });
    return { status: "not_configured" };
  }

  const endpoint = `${base()}/v1/contents`;
  const headers = authHeaders();
  const requestBody = { generationType: brief.generationType, brief };
  const requestBodyText = JSON.stringify(requestBody);

  logger.info("neumos submit request", {
    endpoint,
    method: "POST",
    authorization: maskAuthHeader(headers),
    requestBody,
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: requestBodyText,
    });
    const responseText = await res.text();

    logger.info("neumos submit response", {
      endpoint,
      status: res.status,
      ok: res.ok,
      responseBody: responseText,
    });

    if (!res.ok) {
      logger.warn("neumos submit failed", { status: res.status, responseBody: responseText });
      return { status: "failed", error: `neumos ${res.status}: ${responseText}` };
    }

    let json: NeumosApiResponse;
    try {
      json = JSON.parse(responseText) as NeumosApiResponse;
    } catch (parseErr) {
      logger.error("neumos submit response is not valid JSON", {
        endpoint,
        status: res.status,
        responseBody: responseText,
        parseError: String(parseErr),
      });
      return { status: "failed", error: `neumos returned invalid JSON (status ${res.status}): ${responseText}` };
    }
    return mapResponse(json);
  } catch (err) {
    logger.error("neumos submit error", { endpoint, error: String(err) });
    return { status: "failed", error: String(err) };
  }
}

/**
 * 生成状況を取得する（ポーリング）。
 * - 未接続 / requestId 無しは "not_configured"。
 */
export async function getContentGenerationStatus(requestId: string): Promise<NeumosResult> {
  logConfigStatusOnce();
  if (!isNeumosConfigured()) return { status: "not_configured" };
  if (!requestId) return { status: "not_configured" };

  const endpoint = `${base()}/v1/contents/${encodeURIComponent(requestId)}`;
  const headers = authHeaders();

  logger.info("neumos status request", {
    endpoint,
    method: "GET",
    authorization: maskAuthHeader(headers),
  });

  try {
    const res = await fetch(endpoint, { method: "GET", headers });
    const responseText = await res.text();

    logger.info("neumos status response", {
      endpoint,
      status: res.status,
      ok: res.ok,
      responseBody: responseText,
    });

    if (!res.ok) {
      logger.warn("neumos status failed", { status: res.status, responseBody: responseText });
      return { status: "failed", error: `neumos ${res.status}: ${responseText}` };
    }

    let json: NeumosApiResponse;
    try {
      json = JSON.parse(responseText) as NeumosApiResponse;
    } catch (parseErr) {
      logger.error("neumos status response is not valid JSON", {
        endpoint,
        status: res.status,
        responseBody: responseText,
        parseError: String(parseErr),
      });
      return { status: "failed", error: `neumos returned invalid JSON (status ${res.status}): ${responseText}` };
    }
    return mapResponse(json);
  } catch (err) {
    logger.error("neumos status error", { endpoint, error: String(err) });
    return { status: "failed", error: String(err) };
  }
}

/** @deprecated 旧名。submitContentGeneration を使用。 */
export const submitSiteGeneration = submitContentGeneration;
