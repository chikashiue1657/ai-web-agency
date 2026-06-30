/**
 * Repository ファクトリ。
 * - Supabase設定があれば Supabase 実装、無ければインメモリ実装を返す。
 * - 業務ロジック/UI/APIはこの getRepo() のみに依存する。
 */
import type { Repository } from "./types";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getMemoryRepository } from "./memory";
import { getSupabaseRepository } from "./supabase";

export function getRepo(): Repository {
  return isSupabaseConfigured() ? getSupabaseRepository() : getMemoryRepository();
}

/** UIに「今どの保存先か」を示すためのフラグ。 */
export function isUsingMockDb(): boolean {
  return !isSupabaseConfigured();
}

export * from "./types";
