/**
 * サーバ専用 Supabase クライアント（Neumos AI v1自身の永続化用）。
 * - service role key を使う（RLSバイパス）。サーバコード以外で import しないこと。
 * - 環境変数が無ければ null を返し、呼び出し側はインメモリ実装にフォールバックする
 *   （ローカル開発では未設定でも動作するが、Vercelサーバーレス環境では
 *   インスタンスが使い捨て・複数並行のため、Production運用には必須）。
 * - AI集客支援MVP側のSupabaseプロジェクトとは別物（Neumos AI v1専用）。
 *
 * URLは `SUPABASE_URL`（サーバ専用。クライアントバンドルへ公開する必要が無いため
 * `NEXT_PUBLIC_` 接頭辞は付けない）を優先し、`NEXT_PUBLIC_SUPABASE_URL` が
 * 設定されていればそちらもフォールバックとして受け付ける
 * （過去にこの2つの変数名の不一致で本番のみSupabase未接続扱いになり、
 * インメモリへ静かにフォールバックしていた事故があったため、両対応にしている）。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

function resolveUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = resolveUrl();
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
  return !!resolveUrl() && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
