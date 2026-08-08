/**
 * 問い合わせの180日保持ポリシーの適用（`neumos_site_inquiries`テーブルが対象。
 * `supabase/schema.sql`で定義される名前と一致させるため、テーブル名はここで
 * 直接文字列として保持し、`@/lib/inquiries`等の他ファイルには依存しない）。
 *
 * テーブルがまだ実DBへ適用されていない環境でこのcronが実行された場合に備え、
 * Postgresの42P01（relation does not exist）を検知して0件・skipped扱いにし、
 * 失敗としては検知しない（本来のバグ検知を阻害しないための区別。通常の
 * 運用では発生しない想定の安全側の防御）。
 *
 * 削除条件はcreated_atのみで判定し、氏名・メール・電話・本文等のPIIカラムは
 * 一切SELECTしない。ログにも削除件数とカットオフ時刻のみを残す。
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const INQUIRY_TABLE = "neumos_site_inquiries";
export const INQUIRY_RETENTION_DAYS = 180;

export class InquiryStorageUnavailableError extends Error {
  constructor() {
    super("Inquiry storage is not configured");
    this.name = "InquiryStorageUnavailableError";
  }
}

export interface CleanupResult {
  deleted: number;
  cutoff: string;
  skipped?: true;
}

interface SafeErrorInfo {
  type: string;
  code?: string;
}

function describeErrorSafely(error: unknown): SafeErrorInfo {
  if (error && typeof error === "object") {
    const name =
      "name" in error && typeof (error as { name?: unknown }).name === "string"
        ? (error as { name: string }).name
        : undefined;
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    return { type: name || "UnknownError", code };
  }
  return { type: "UnknownError" };
}

function isUndefinedTableError(error: unknown): boolean {
  return !!error && typeof error === "object" && (error as { code?: unknown }).code === "42P01";
}

/**
 * 冪等: created_at基準のカットオフより古い行だけを対象にするため、削除対象が
 * 既に無い状態で再実行しても副作用なく`{ deleted: 0 }`を返す。
 */
export async function cleanupExpiredInquiries(now: Date = new Date()): Promise<CleanupResult> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new InquiryStorageUnavailableError();

  const cutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin.from(INQUIRY_TABLE).delete().lt("created_at", cutoff).select("id");

  if (error) {
    if (isUndefinedTableError(error)) {
      console.log("[neumos-ai] inquiry cleanup skipped: table not provisioned yet", { cutoff });
      return { deleted: 0, cutoff, skipped: true };
    }
    console.error("[neumos-ai] inquiry cleanup failed", { cutoff, ...describeErrorSafely(error) });
    throw error;
  }

  const deleted = data?.length ?? 0;
  console.log("[neumos-ai] inquiry cleanup completed", { cutoff, deleted });
  return { deleted, cutoff };
}
