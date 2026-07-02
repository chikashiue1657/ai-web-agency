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
  /**
   * 例外オブジェクトの生の情報。Supabase(PostgrestError)の code/details/hint を含め、
   * 存在するプロパティだけをそのまま格納する（無いものは省き、値を作らない）。
   */
  errorCause: ErrorCause | null;
}

export interface ErrorCause {
  name?: string;
  message?: string;
  /** Postgrest/Postgresのエラーコード（例: 42P01 = relation does not exist）。 */
  code?: string;
  /** Postgrestのdetails（例: 存在しないテーブル名など）。 */
  details?: string;
  /** Postgrestのhint（対処のヒント）。 */
  hint?: string;
  stack?: string;
}

/**
 * 例外から、あるかどうか分からないプロパティ(code/details/hint等)だけを
 * そのまま抜き出す。Supabase PostgrestError・ServiceError・素のErrorのいずれでも、
 * 存在する項目だけを拾い、無い項目を捏造しない。
 */
export function extractErrorCause(err: unknown): ErrorCause {
  if (err instanceof Error) {
    const withPg = err as Error & { code?: unknown; details?: unknown; hint?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: typeof withPg.code === "string" ? withPg.code : undefined,
      details: typeof withPg.details === "string" ? withPg.details : undefined,
      hint: typeof withPg.hint === "string" ? withPg.hint : undefined,
      stack: err.stack,
    };
  }
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    return {
      message: typeof obj.message === "string" ? obj.message : String(err),
      code: typeof obj.code === "string" ? obj.code : undefined,
      details: typeof obj.details === "string" ? obj.details : undefined,
      hint: typeof obj.hint === "string" ? obj.hint : undefined,
    };
  }
  return { message: String(err) };
}

/**
 * 生成パイプライン中の失敗（Neumos HTTP呼び出し以前の診断・保存処理の失敗を含む）を
 * NeumosErrorDetail付きで運ぶ例外。呼び出し側(actions.ts)は`.detail`をそのまま
 * 画面のJSON詳細表示に使う（メッセージへの要約・変換をしない）。
 */
export class ContentGenerationError extends Error {
  constructor(message: string, public readonly detail: NeumosErrorDetail) {
    super(message);
    this.name = "ContentGenerationError";
  }
}

export function isNeumosConfigured(): boolean {
  return !!process.env.NEUMOS_API_URL && !!process.env.NEUMOS_API_KEY;
}

/** Authorizationヘッダーの値を先頭5文字だけ残して伏字にする。 */
function maskAuthorization(): string {
  const key = process.env.NEUMOS_API_KEY ?? "";
  return `Bearer ${key.slice(0, 5)}${"*".repeat(Math.max(key.length - 5, 0))}`;
}

/**
 * Neumos呼び出しの「意図した」リクエスト情報（URL/method/headers/body）を組み立てる。
 * `callNeumos`本体と、呼び出し前の失敗（診断・保存エラー等）を報告する
 * `buildUnreachedErrorDetail`の両方から使う共通部品。
 */
function describeRequest(path: string, method: "GET" | "POST", body?: unknown) {
  const base = process.env.NEUMOS_API_URL
    ? process.env.NEUMOS_API_URL.replace(/\/$/, "")
    : "(NEUMOS_API_URL未設定)";
  return {
    requestUrl: `${base}${path}`,
    requestMethod: method,
    requestHeaders: { authorization: maskAuthorization(), "content-type": "application/json" },
    requestBody: body ?? null,
  };
}

/**
 * Neumos HTTP呼び出しへ到達する前（AI診断・DB保存等）に例外が発生した場合の
 * NeumosErrorDetailを組み立てる。実際にHTTP通信していないため response系はnull、
 * networkErrorに実際の例外情報をそのまま入れる（要約しない）。
 */
export function buildUnreachedErrorDetail(
  generationType: string,
  brief: unknown,
  err: unknown
): NeumosErrorDetail {
  const req = describeRequest("/v1/contents", "POST", brief ? { generationType, brief } : null);
  const cause = extractErrorCause(err);
  return {
    ...req,
    responseStatus: null,
    responseHeaders: null,
    responseBody: null,
    networkError:
      err instanceof Error
        ? `${err.name}: ${err.message}`
        : `Neumos呼び出しに到達する前に失敗: ${String(err)}`,
    errorCause: cause,
  };
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
  const req = describeRequest(path, method, requestBody);

  const detail: NeumosErrorDetail = {
    ...req,
    responseStatus: null,
    responseHeaders: null,
    responseBody: null,
    networkError: null,
    errorCause: null,
  };

  let res: Response;
  try {
    res = await fetch(req.requestUrl, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.NEUMOS_API_KEY as string}`,
      },
      ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {}),
    });
  } catch (err) {
    detail.networkError = err instanceof Error ? err.message : String(err);
    detail.errorCause = extractErrorCause(err);
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
