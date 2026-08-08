import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGenerationRecord } from "@/lib/store";
import { describeErrorSafely } from "@/lib/inquiry-log";

export const INQUIRY_TABLE = "neumos_site_inquiries";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const PublicInquirySchema = z
  .object({
    requestId: z.string().uuid(),
    inquiryType: z.enum(["reservation", "general"]),
    name: z.string().trim().min(1).max(80),
    email: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().email().max(254).optional()
    ),
    phone: optionalText(32),
    preferredDate: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDate, "正しい日付を入力してください").optional()
    ),
    message: z.string().trim().min(1).max(1200),
    consent: z.literal(true),
    website: z.string().max(256).optional().default(""),
    startedAt: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (!value.email && !value.phone) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "メールアドレスまたは電話番号を入力してください",
      });
    }
  });

export type PublicInquiryInput = z.infer<typeof PublicInquirySchema>;

export interface StoredInquiry {
  id: string;
  requestId: string;
  storeName: string;
  inquiryType: "reservation" | "general";
  name: string;
  email?: string;
  phone?: string;
  preferredDate?: string;
  message: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
}

export class InquiryStorageUnavailableError extends Error {
  constructor() {
    super("Inquiry storage is not configured");
    this.name = "InquiryStorageUnavailableError";
  }
}

/**
 * INQUIRY_HASH_SALT未設定時にfail-openなフォールバック（他用途の秘密の流用や
 * ハードコード文字列）へ落ちないようにするための専用エラー。呼び出し側
 * （route.ts）はこれを503として扱う。
 */
export class InquiryHashSaltMissingError extends Error {
  constructor() {
    super("INQUIRY_HASH_SALT is not configured");
    this.name = "InquiryHashSaltMissingError";
  }
}

/**
 * INQUIRY_HASH_SALTの読み取り・検証はPOSTルートの先頭で一度だけ行い、以降は
 * 検証済みの値を引数として渡し回す（処理途中でprocess.envを再読込しない）。
 * undefined・空文字・空白のみは未設定として扱う。
 */
export function resolveInquiryHashSalt(): string | undefined {
  const trimmed = process.env.INQUIRY_HASH_SALT?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * saltは呼び出し側（route.ts）が`resolveInquiryHashSalt()`で検証済みの値を
 * 渡す前提。ここでも空値ならエラーにする（多重防御。process.envの再読込はしない）。
 */
function hashIp(ip: string, salt: string): string {
  if (!salt) throw new InquiryHashSaltMissingError();
  return createHmac("sha256", salt).update(ip).digest("hex");
}

function dedupeKey(input: PublicInquiryInput): string {
  const normalized = [
    input.requestId,
    input.inquiryType,
    input.name.toLowerCase(),
    input.email?.toLowerCase() ?? "",
    input.phone ?? "",
    input.preferredDate ?? "",
    input.message,
  ].join("\u001f");
  return createHash("sha256").update(normalized).digest("hex");
}

export async function savePublicInquiry(
  input: PublicInquiryInput,
  sourceIp: string,
  salt: string
): Promise<StoredInquiry> {
  const generation = await getGenerationRecord(input.requestId);
  if (!generation) throw new Error("generation_not_found");

  const admin = getSupabaseAdmin();
  if (!admin) throw new InquiryStorageUnavailableError();

  const id = randomUUID();
  const row = {
    id,
    request_id: input.requestId,
    store_name: generation.brief.storeName,
    inquiry_type: input.inquiryType,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    preferred_date: input.preferredDate ?? null,
    message: input.message,
    status: "new",
    dedupe_key: dedupeKey(input),
    source_ip_hash: hashIp(sourceIp, salt),
  };

  const { data, error } = await admin.from(INQUIRY_TABLE).insert(row).select("*").single();
  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await admin
        .from(INQUIRY_TABLE)
        .select("*")
        .eq("dedupe_key", row.dedupe_key)
        .single();
      if (!existingError && existing) return rowToInquiry(existing);
    }
    throw error;
  }

  return rowToInquiry(data);
}

function rowToInquiry(row: Record<string, unknown>): StoredInquiry {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    storeName: String(row.store_name),
    inquiryType: row.inquiry_type === "reservation" ? "reservation" : "general",
    name: String(row.name),
    email: typeof row.email === "string" ? row.email : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
    preferredDate: typeof row.preferred_date === "string" ? row.preferred_date : undefined,
    message: String(row.message),
    status: row.status === "contacted" || row.status === "closed" ? row.status : "new",
    createdAt: String(row.created_at),
  };
}

export async function listInquiries(limit = 100): Promise<StoredInquiry[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new InquiryStorageUnavailableError();
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const { data, error } = await admin
    .from(INQUIRY_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw error;
  return (data ?? []).map((row) => rowToInquiry(row as Record<string, unknown>));
}

export type DeleteInquiryResult = "deleted" | "not_found";

/**
 * 管理者による個別の物理削除（DELETE /v1/inquiries/[id]用）。論理削除
 * （deleted_atを立てるだけ）は採用しない方針のため、行そのものを削除する。
 * ログにはID・結果のみを残し、氏名・メール・電話・本文等のPIIは一切出さない。
 */
export async function deleteInquiryById(id: string): Promise<DeleteInquiryResult> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new InquiryStorageUnavailableError();

  const { data, error } = await admin.from(INQUIRY_TABLE).delete().eq("id", id).select("id");
  if (error) {
    console.error("[neumos-ai] inquiry delete failed", { id, ...describeErrorSafely(error) });
    throw error;
  }
  const outcome: DeleteInquiryResult = data && data.length > 0 ? "deleted" : "not_found";
  console.log("[neumos-ai] inquiry delete", { id, outcome });
  return outcome;
}
