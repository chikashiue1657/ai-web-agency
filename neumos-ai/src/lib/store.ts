/**
 * 生成結果の永続化ストア。
 *
 * - Supabase（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）が設定されていれば
 *   `neumos_content_generation_requests` テーブルへ保存し、Vercelのどのサーバーレスインスタンス・
 *   再起動後からでも `/preview/[requestId]` を再取得できるようにする。
 *   （テーブル名にneumos_接頭辞。MVP側と同一Supabaseプロジェクトを共有する運用でも
 *   テーブル名が衝突しないようにするため。詳細はsupabase/schema.sqlのコメント参照）
 * - 未設定（ローカル開発等）ならインメモリにフォールバックする
 *   （同一プロセス内でのみ有効。Production運用では必ずSupabaseを設定すること）。
 */
import { getSupabaseAdmin, getSupabaseProjectRef } from "@/lib/supabase/server";
import type {
  GeneratedWebsiteContents,
  GenerateStatus,
  GenerationMethod,
  GenerationType,
  StoreBrief,
  StoredGenerationRecord,
} from "@/lib/types";
import type { BrandPlan } from "@/lib/brand-director/types";

const globalForStore = globalThis as unknown as {
  __neumosStore?: Map<string, StoredGenerationRecord>;
};
const memStore = globalForStore.__neumosStore ?? new Map<string, StoredGenerationRecord>();
globalForStore.__neumosStore = memStore;

/** 実際にSupabaseへ読み書きするテーブル名。ここを唯一の真実の源にする。 */
export const TABLE_NAME = "neumos_content_generation_requests";

function logTableAccess(op: string, extra?: Record<string, unknown>) {
  console.log(`[neumos-ai] store.${op}: Supabaseアクセス`, {
    table: TABLE_NAME,
    projectRef: getSupabaseProjectRef(),
    ...extra,
  });
}

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
  /** カフェ業態のみ生成時に一度だけ作成されるBrandPlan（nullable・後方互換）。 */
  brand_plan: BrandPlan | null;
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
    // 旧レコード（列追加前に作成された行）はnullのため、undefinedへ揃える。
    brandPlan: row.brand_plan ?? undefined,
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
    brand_plan: record.brandPlan ?? null,
  };
}

export async function saveGenerationRecord(record: StoredGenerationRecord): Promise<void> {
  memStore.set(record.requestId, record);

  const admin = getSupabaseAdmin();
  if (!admin) return;

  logTableAccess("saveGenerationRecord", { requestId: record.requestId });
  const { error } = await admin
    .from(TABLE_NAME)
    .upsert(recordToRow(record), { onConflict: "request_id" });
  if (error) throw error;
}

export async function getGenerationRecord(requestId: string): Promise<StoredGenerationRecord | undefined> {
  const admin = getSupabaseAdmin();
  if (!admin) return memStore.get(requestId);

  logTableAccess("getGenerationRecord", { requestId });
  const { data, error } = await admin
    .from(TABLE_NAME)
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

  logTableAccess("listGenerationRecords");
  const { data, error } = await admin
    .from(TABLE_NAME)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ContentGenerationRequestRow[]).map(rowToRecord);
}
