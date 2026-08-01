"use server";
/**
 * Server Actions（管理画面のボタン操作用）。
 * - APIと同じサービス層を呼ぶ。UIからの操作後は revalidatePath で再描画。
 * - 失敗時はthrowせず結果を返してUIで扱いやすくする。
 * - 外部API/LLM呼び出しを伴うアクションは、ServiceError以外の例外も
 *   要約せず errorDetail（NeumosErrorDetail形状）としてそのまま返す
 *   （画面の「エラー詳細を表示」でHTTP Status/URL/Request Method/Request Body/
 *   Response Body/Network Errorを確認できる）。
 */
import { revalidatePath } from "next/cache";
import {
  scoreStore,
  generateProposal,
  generateSite,
  updateNotes,
  updateStatus,
  searchAndIngestPlaces,
  generateOutreach,
  requestContentGeneration,
  refreshContentGenerationStatus,
  runStoreDiagnosis,
  updateStoreMenu,
} from "@/lib/services";
import { ServiceError } from "@/lib/errors";
import { ContentGenerationError, type NeumosErrorDetail } from "@/lib/neumos/client";
import { serializeUnknownError } from "@/lib/action-error";
import type {
  LeadStatus,
  ContentGenerationRequest,
  GenerationType,
  StoreStrategy,
} from "@/lib/types";
import type { OutreachChannel } from "@/lib/outreach";

/** ServiceError以外の例外を errorDetail 付きの失敗結果に変換する共通ヘルパー。 */
function toFailure(err: unknown, fallbackMessage: string): { ok: false; error: string; errorDetail: NeumosErrorDetail | null } {
  if (err instanceof ServiceError) {
    return { ok: false, error: err.message, errorDetail: null };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : fallbackMessage,
    errorDetail: serializeUnknownError(err),
  };
}

/**
 * 店舗取得（Google Places API New）を server action として実行。
 * - UIから直接呼ぶため、内部APIキー(INTERNAL_API_KEY)ゲートの対象外。
 *   （ブラウザは秘密ヘッダを保持できないため、UI起点の処理はserver actionに寄せる）
 * - 例外は投げず、UIで扱いやすい結果オブジェクトを返す。
 */
export type SearchPlacesActionResult =
  | { ok: true; found: number; inserted: number; updated: number; scored: number }
  | { ok: false; error: string; errorDetail: NeumosErrorDetail | null };

export async function searchPlacesAction(
  query: string
): Promise<SearchPlacesActionResult> {
  try {
    const r = await searchAndIngestPlaces(query);
    // 一覧・ダッシュボードを再取得
    revalidatePath("/stores");
    revalidatePath("/");
    return {
      ok: true,
      found: r.found,
      inserted: r.inserted,
      updated: r.updated,
      scored: r.scored,
    };
  } catch (err) {
    return toFailure(err, "店舗取得に失敗しました");
  }
}

/** 優先度判定 / 提案書生成 / 仮サイト生成 共通の結果型。 */
export type SimpleActionResult =
  | { ok: true }
  | { ok: false; error: string; errorDetail: NeumosErrorDetail | null };

export async function scoreStoreAction(storeId: string): Promise<SimpleActionResult> {
  try {
    await scoreStore(storeId, { useLlm: true });
    revalidatePath(`/stores/${storeId}`);
    revalidatePath("/stores");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return toFailure(err, "優先度判定に失敗しました");
  }
}

export async function generateProposalAction(
  storeId: string,
  reviewSummary?: string
): Promise<SimpleActionResult> {
  try {
    await generateProposal(storeId, { useLlm: true, review_summary: reviewSummary || null });
    revalidatePath(`/stores/${storeId}`);
    return { ok: true };
  } catch (err) {
    return toFailure(err, "提案書生成に失敗しました");
  }
}

export async function generateSiteAction(storeId: string): Promise<SimpleActionResult> {
  try {
    await generateSite(storeId, {});
    revalidatePath(`/stores/${storeId}`);
    return { ok: true };
  } catch (err) {
    return toFailure(err, "仮サイト生成に失敗しました");
  }
}

export async function saveNotesAction(storeId: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "");
  await updateNotes(storeId, notes);
  revalidatePath(`/stores/${storeId}`);
}

export async function saveStoreMenuAction(storeId: string, formData: FormData) {
  const raw = String(formData.get("menuItems") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("メニューの形式が正しくありません");
  }
  if (!Array.isArray(parsed)) throw new Error("メニューの形式が正しくありません");
  const items = parsed.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name) return [];
    const price = typeof value.price === "string" ? value.price.trim() : "";
    const description = typeof value.description === "string" ? value.description.trim() : "";
    return [{
      name: name.slice(0, 80),
      ...(price ? { price: price.slice(0, 40) } : {}),
      ...(description ? { description: description.slice(0, 240) } : {}),
    }];
  });
  await updateStoreMenu(storeId, items);
  revalidatePath(`/stores/${storeId}`);
}

export async function updateStatusAction(storeId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "todo") as LeadStatus;
  const contactMethod = String(formData.get("contact_method") ?? "") || undefined;
  await updateStatus(storeId, status, contactMethod);
  revalidatePath(`/stores/${storeId}`);
}

/** ワンクリックでステータスを進める（営業管理のクイックボタン用）。 */
export async function setStatusAction(storeId: string, status: LeadStatus) {
  await updateStatus(storeId, status);
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/stores");
}

/**
 * アウトリーチ文面生成（④メール ⑤DM ⑥電話トーク）。
 * - 例外は投げず結果オブジェクトを返し、UIで表示・コピーしやすくする。
 */
export type OutreachActionResult =
  | { ok: true; text: string }
  | { ok: false; error: string; errorDetail: NeumosErrorDetail | null };

export async function generateOutreachAction(
  storeId: string,
  channel: OutreachChannel
): Promise<OutreachActionResult> {
  try {
    const text = await generateOutreach(storeId, channel);
    revalidatePath(`/stores/${storeId}`);
    return { ok: true, text };
  } catch (err) {
    return toFailure(err, "文面生成に失敗しました");
  }
}

/**
 * ノイモスAIへ本番サイト生成を依頼（未接続なら下書き保存）。
 * - 生成した受け渡しブリーフを返し、UIで内容を確認できるようにする。
 */
export type ContentGenerationActionResult =
  | { ok: true; connected: boolean; request: ContentGenerationRequest }
  | { ok: false; error: string; errorDetail: NeumosErrorDetail | null };

export async function requestContentGenerationAction(
  storeId: string,
  generationType: GenerationType = "website"
): Promise<ContentGenerationActionResult> {
  try {
    const { request, connected } = await requestContentGeneration(storeId, generationType);
    revalidatePath(`/stores/${storeId}`);
    return { ok: true, connected, request };
  } catch (err) {
    revalidatePath(`/stores/${storeId}`); // 失敗レコードが保存されていれば一覧に反映する
    if (err instanceof ContentGenerationError) {
      return { ok: false, error: err.message, errorDetail: err.detail };
    }
    return toFailure(err, "コンテンツ生成依頼に失敗しました");
  }
}

/**
 * 生成状況を更新（ノイモスAIへポーリング）。更新後のリクエストを返す。
 */
export async function refreshContentStatusAction(
  storeId: string,
  requestRowId: string
): Promise<ContentGenerationActionResult> {
  try {
    const request = await refreshContentGenerationStatus(requestRowId);
    if (!request) return { ok: false, error: "リクエストが見つかりません", errorDetail: null };
    revalidatePath(`/stores/${storeId}`);
    return { ok: true, connected: !!request.external_id, request };
  } catch (err) {
    return toFailure(err, "状況更新に失敗しました");
  }
}

/**
 * AI診断を作成（Thinking Engine）。StoreStrategy を生成・保存する。
 */
export type DiagnosisActionResult =
  | { ok: true; strategy: StoreStrategy }
  | { ok: false; error: string; errorDetail: NeumosErrorDetail | null };

export async function runDiagnosisAction(storeId: string): Promise<DiagnosisActionResult> {
  try {
    const strategy = await runStoreDiagnosis(storeId, { useLlm: true });
    revalidatePath(`/stores/${storeId}`);
    return { ok: true, strategy };
  } catch (err) {
    return toFailure(err, "AI診断に失敗しました");
  }
}
