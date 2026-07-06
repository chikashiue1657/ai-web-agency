import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Vercel側で SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を設定していたのに対し、
 * コードが NEXT_PUBLIC_SUPABASE_URL しか見ておらず、Productionで常にnull
 * （インメモリへ静かにフォールバック）になっていた実際の障害の再発防止テスト。
 */
describe("getSupabaseAdmin / isSupabaseConfigured の環境変数名解決", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("SUPABASE_URL（NEXT_PUBLIC_接頭辞なし）だけでも設定済みと判定される", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { isSupabaseConfigured } = await import("@/lib/supabase/server");
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("NEXT_PUBLIC_SUPABASE_URL のみでもフォールバックとして受け付ける", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { isSupabaseConfigured } = await import("@/lib/supabase/server");
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("URLが両方とも未設定なら未設定と判定される（インメモリへフォールバック）", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { isSupabaseConfigured } = await import("@/lib/supabase/server");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("SUPABASE_SERVICE_ROLE_KEYが無ければURLがあっても未設定と判定される", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";

    const { isSupabaseConfigured } = await import("@/lib/supabase/server");
    expect(isSupabaseConfigured()).toBe(false);
  });
});
