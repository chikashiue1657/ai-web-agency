/**
 * 生成結果の永続化ストア。
 *
 * - Supabase（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）が設定されていれば
 *   `content_generation_requests` テーブルへ保存し、Vercelのどのサーバーレスインスタンス・
 *   再起動後からでも `/preview/[requestId]` を再取得できるようにする。
 * - 未設定（ローカル開発等）ならインメモリにフォールバックする
 *   （同一プロセス内でのみ有効。Production運用では必ずSupabaseを設定すること）。
 */
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  GeneratedWebsiteContents,
  GenerateStatus,
  GenerationMethod,
  GenerationType,
  StoreBrief,
  StoredGenerationRecord,
} from "@/lib/types";

const globalForStore = globalThis as unknown as {
  __neumosStore?: Map<string, StoredGenerationRecord>;
};
const memStore = globalForStore.__neumosStore ?? new Map<string, StoredGenerationRecord>();
globalForStore.__neumosStore = memStore;

interface ContentGenerationRequestRow {
  request_id: string;
  generation_type: GenerationType;
  brief: StoreBrief;
  status: GenerateStatus;
  method: GenerationMethod;
  generated_contents: GeneratedWebsiteContents;
  preview_html: string;
  preview_url: string;
  published_url: string | null;
  created_at: string;
}

function rowToRecord(row: ContentGenerationRequestRow): StoredGenerationRecord {
  return {
    requestId: row.request_id,
    generationType: row.generation_type,
    brief: row.brief,
    status: row.status,
    method: row.method,
    generatedContents: row.generated_contents,
    previewHtml: row.preview_html,
    previewUrl: row.preview_url,
    publishedUrl: row.published_url,
    createdAt: row.created_at,
  };
}

function recordToRow(record: StoredGenerationRecord): ContentGenerationRequestRow {
  return {
    request_id: record.requestId,
    generation_type: record.generationType,
    brief: record.brief,
    status: record.status,
    method: record.method,
    generated_contents: record.generatedContents,
    preview_html: record.previewHtml,
    preview_url: record.previewUrl,
    published_url: record.publishedUrl,
    created_at: record.createdAt,
  };
}

export async function saveGenerationRecord(record: StoredGenerationRecord): Promise<void> {
  memStore.set(record.requestId, record);

  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error } = await admin
    .from("content_generation_requests")
    .upsert(recordToRow(record), { onConflict: "request_id" });
  if (error) throw error;
}

export async function getGenerationRecord(requestId: string): Promise<StoredGenerationRecord | undefined> {
  const admin = getSupabaseAdmin();
  if (!admin) return memStore.get(requestId);

  const { data, error } = await admin
    .from("content_generation_requests")
    .select("*")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRecord(data as ContentGenerationRequestRow) : undefined;
}

export async function listGenerationRecords(): Promise<StoredGenerationRecord[]> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return Array.from(memStore.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  const { data, error } = await admin
    .from("content_generation_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ContentGenerationRequestRow[]).map(rowToRecord);
}
