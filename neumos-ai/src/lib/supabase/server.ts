/**
 * サーバ専用 Supabase クライアント（Neumos AI v1自身の永続化用）。
 * - service role key を使う（RLSバイパス）。サーバコード以外で import しないこと。
 * - 環境変数が無ければ null を返し、呼び出し側はインメモリ実装にフォールバックする
 *   （ローカル開発では未設定でも動作するが、Vercelサーバーレス環境では
 *   インスタンスが使い捨て・複数並行のため、Production運用には必須）。
 * - AI集客支援MVP側のSupabaseプロジェクトとは別物（Neumos AI v1専用）。
 *   同じ変数名(NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)を使うが、
 *   Vercelプロジェクトが分かれているため値が衝突することはない。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
