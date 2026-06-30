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
} from "@/lib/services";
import type { LeadStatus } from "@/lib/types";

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
