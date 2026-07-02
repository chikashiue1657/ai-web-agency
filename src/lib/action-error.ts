/**
 * server action全般で使う、予期しない例外をUIの「エラー詳細を表示」でそのまま
 * 確認できる形に落とす共通ヘルパー。値を要約・推測せず、例外が持つ情報をそのまま格納する。
 * Neumos連携に限らず、AI診断・優先度判定・提案書生成・仮サイト生成・アウトリーチ生成・
 * 店舗取得など、外部API/LLM呼び出しを伴う全アクションで共有する。
 */
import type { NeumosErrorDetail } from "@/lib/neumos/client";

export function serializeUnknownError(err: unknown): NeumosErrorDetail {
  return {
    requestUrl: "(unknown — request did not reach an external API client)",
    requestMethod: "(unknown)",
    requestHeaders: { authorization: "(n/a)", "content-type": "(n/a)" },
    requestBody: null,
    responseStatus: null,
    responseHeaders: null,
    responseBody: null,
    networkError:
      err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err),
  };
}
