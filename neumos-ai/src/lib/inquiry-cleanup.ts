/**
 * 問い合わせの180日保持ポリシーの適用（`neumos_site_inquiries`テーブルが対象。
 * `supabase/schema.sql`で定義される名前と一致させるため、テーブル名はここで
 * 直接文字列として保持し、`@/lib/inquiries`等の他ファイルには依存しない）。
 *
 * テーブル未作成（Postgres 42P01: relation does not exist）は、削除が実際には
 * 一切行われていない失敗として扱う（`{ deleted: 0, skipped: true }`のような
 * 成功扱いにはしない。Vercel Cron側が非2xxとして検知できるよう、routeは
 * 503を返す）。
 *
 * 削除件数はSupabaseの`count: "exact"`オプションで取得し、削除された行の
 * ID等は取得・保持しない（PIIカラムはそもそも一切SELECTしない）。ログにも
 * 削除件数とカットオフ時刻のみを残す。
 *
 * `count: "exact"`を指定したにもかかわらずerrorなしで`count`が
 * null・負数・非整数として返る場合は、実際に何件削除されたか確定できない
 * 異常事態として扱う（`deleted: 0`のような憶測値で成功扱いにはしない）。
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

export class InquiryTableUnavailableError extends Error {
  constructor() {
    super("Inquiry table is not available");
    this.name = "InquiryTableUnavailableError";
  }
}

export class InquiryDeleteCountUnavailableError extends Error {
  constructor() {
    super("Inquiry delete count is not available");
    this.name = "InquiryDeleteCountUnavailableError";
  }
}

export interface CleanupResult {
  deleted: number;
  cutoff: string;
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

// Supabaseが`count: "exact"`でerrorなしに返す`count`は、型上`number | null`
// だが、実際に信頼できるのは0以上の整数のみ。null・NaN・負数・小数は
// 「何件削除されたか確定できない」異常として扱い、0件成功と取り違えない。
function isValidDeletedCount(count: number | null): count is number {
  return typeof count === "number" && Number.isInteger(count) && count >= 0;
}

/**
 * 冪等: created_at基準のカットオフより古い行だけを対象にするため、削除対象が
 * 既に無い状態で再実行しても副作用なく`{ deleted: 0 }`を返す。
 */
export async function cleanupExpiredInquiries(now: Date = new Date()): Promise<CleanupResult> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new InquiryStorageUnavailableError();

  const cutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await admin.from(INQUIRY_TABLE).delete({ count: "exact" }).lt("created_at", cutoff);

  if (error) {
    if (isUndefinedTableError(error)) {
      console.error("[neumos-ai] inquiry cleanup failed: table not provisioned", { cutoff, code: "42P01" });
      throw new InquiryTableUnavailableError();
    }
    console.error("[neumos-ai] inquiry cleanup failed", { cutoff, ...describeErrorSafely(error) });
    throw error;
  }

  if (!isValidDeletedCount(count)) {
    console.error("[neumos-ai] inquiry cleanup failed: delete count unavailable", { cutoff });
    throw new InquiryDeleteCountUnavailableError();
  }

  console.log("[neumos-ai] inquiry cleanup completed", { cutoff, deleted: count });
  return { deleted: count, cutoff };
}
