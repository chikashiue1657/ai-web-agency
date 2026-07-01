"use server";
/**
 * Server Actions（管理画面のボタン操作用）。
 * - APIと同じサービス層を呼ぶ。UIからの操作後は revalidatePath で再描画。
 * - 失敗時はthrowせず結果を返してUIで扱いやすくする。
 */
import { revalidatePath } from "next/cache";
import {
  scoreStore,
  generateProposal,
  generateSite,
  updateNotes,
  updateStatus,
  searchAndIngestPlaces,
} from "@/lib/services";
import { ServiceError } from "@/lib/errors";
import type { LeadStatus } from "@/lib/types";

/**
 * 店舗取得（Google Places API New）を server action として実行。
 * - UIから直接呼ぶため、内部APIキー(INTERNAL_API_KEY)ゲートの対象外。
 *   （ブラウザは秘密ヘッダを保持できないため、UI起点の処理はserver actionに寄せる）
 * - 例外は投げず、UIで扱いやすい結果オブジェクトを返す。
 */
export type SearchPlacesActionResult =
  | { ok: true; found: number; inserted: number; updated: number; scored: number }
  | { ok: false; error: string };

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
    const message =
      err instanceof ServiceError ? err.message : "店舗取得に失敗しました";
    return { ok: false, error: message };
  }
}

export async function scoreStoreAction(storeId: string) {
  await scoreStore(storeId, { useLlm: true });
  revalidatePath(`/stores/${storeId}`);
  revalidatePath("/stores");
  revalidatePath("/");
}

export async function generateProposalAction(storeId: string, reviewSummary?: string) {
  await generateProposal(storeId, { useLlm: true, review_summary: reviewSummary || null });
  revalidatePath(`/stores/${storeId}`);
}

export async function generateSiteAction(storeId: string) {
  await generateSite(storeId, {});
  revalidatePath(`/stores/${storeId}`);
}

export async function saveNotesAction(storeId: string, formData: FormData) {
  const notes = String(formData.get("notes") ?? "");
  await updateNotes(storeId, notes);
  revalidatePath(`/stores/${storeId}`);
}

export async function updateStatusAction(storeId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "new") as LeadStatus;
  const contactMethod = String(formData.get("contact_method") ?? "") || undefined;
  await updateStatus(storeId, status, contactMethod);
  revalidatePath(`/stores/${storeId}`);
}
