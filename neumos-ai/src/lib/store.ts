/**
 * 生成結果のインメモリストア。
 *
 * 注意（本番運用時の制約）:
 *  - Vercelのサーバーレス関数はインスタンスが使い捨て・複数並行のため、
 *    このインメモリ実装は「同一インスタンス内・開発時」の動作確認用途に限定される。
 *  - 本番で `/preview/[requestId]` を安定して提供するには、Vercel KV / Supabase 等の
 *    永続ストアに差し替えること（このファイルのインターフェースだけを差し替えればよい設計）。
 */
import type { StoredGenerationRecord } from "@/lib/types";

const globalForStore = globalThis as unknown as {
  __neumosStore?: Map<string, StoredGenerationRecord>;
};

const store = globalForStore.__neumosStore ?? new Map<string, StoredGenerationRecord>();
globalForStore.__neumosStore = store;

export function saveGenerationRecord(record: StoredGenerationRecord): void {
  store.set(record.requestId, record);
}

export function getGenerationRecord(requestId: string): StoredGenerationRecord | undefined {
  return store.get(requestId);
}

export function listGenerationRecords(): StoredGenerationRecord[] {
  return Array.from(store.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
