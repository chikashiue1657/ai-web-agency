/**
 * ノイモスAI（ホームページ自動生成AI）連携クライアント（アダプタ）。
 *
 * 設計:
 *  - 生成エンジンを疎結合にするための境界。ここだけ差し替えれば本接続できる。
 *  - 環境変数(NEUMOS_API_URL / NEUMOS_API_KEY)が無ければ "not_configured" を返し、
 *    UI/業務ロジックは壊れずに「未接続」として扱える（LLMクライアントと同方針）。
 *  - 入力は SiteGenerationBrief（契約）。実装はHTTP POSTを想定したスタブ。
 *
 * 将来の本接続:
 *  - submitContentGeneration: brief(generationType付き) を POST し、ジョブID を受け取る。
 *  - 生成種別(website/blog/instagram等)は brief.generationType で分岐（エンドポイントは共通）。
 *  - Webhook/ポーリングで status を更新（queued→generating→preview→published）。
 *  - 公開は GitHub+Vercel / Cloudflare 側の自動化と組み合わせる。
 */
import type { NeumosBrief, ContentGenStatus } from "@/lib/types";
import { logger } from "@/lib/logger";

export interface NeumosSubmitResult {
  /** not_configured = 未接続（ブリーフのJSONプレビュー用途を含む） */
  status: ContentGenStatus | "not_configured";
  externalId?: string;
  previewUrl?: string;
  error?: string;
}

export function isNeumosConfigured(): boolean {
  return !!process.env.NEUMOS_API_URL && !!process.env.NEUMOS_API_KEY;
}

/**
 * コンテンツ生成ジョブを投入する（種別は brief.generationType）。
 * - 未接続時は { status: "not_configured" }（例外を投げない）。
 * - 接続時は brief を POST（実エンドポイント仕様確定後にレスポンスマッピングを調整）。
 */
export async function submitContentGeneration(
  brief: NeumosBrief
): Promise<NeumosSubmitResult> {
  if (!isNeumosConfigured()) {
    return { status: "not_configured" };
  }

  const url = process.env.NEUMOS_API_URL as string;
  const key = process.env.NEUMOS_API_KEY as string;

  try {
    // 種別横断の共通エンドポイント。brief.generationType でノイモスAI側が分岐する想定。
    const res = await fetch(url.replace(/\/$/, "") + "/v1/contents", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ generationType: brief.generationType, brief }),
    });

    if (!res.ok) {
      const detail = await res.text();
      logger.warn("neumos submit failed", { status: res.status, detail: detail.slice(0, 300) });
      return { status: "failed", error: `neumos ${res.status}` };
    }

    // 想定レスポンス: { id, status, previewUrl }（本仕様確定時に調整）
    const json = (await res.json()) as {
      id?: string;
      status?: ContentGenStatus;
      previewUrl?: string;
    };
    return {
      status: json.status ?? "queued",
      externalId: json.id,
      previewUrl: json.previewUrl,
    };
  } catch (err) {
    logger.error("neumos submit error", { error: String(err) });
    return { status: "failed", error: String(err) };
  }
}

/** @deprecated 旧名。submitContentGeneration を使用（後方互換のため残置）。 */
export const submitSiteGeneration = submitContentGeneration;
