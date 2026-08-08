import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

import { isInquiryRateLimited, RateLimitCheckFailedError } from "@/lib/inquiry-rate-limit";

describe("inquiry rate limiting (Postgres-backed, shared across serverless instances)", () => {
  beforeEach(() => {
    mocks.getSupabaseAdmin.mockReset();
  });

  it("allows five submissions and rejects the sixth when the RPC reports the limit hit", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    mocks.getSupabaseAdmin.mockReturnValue({ rpc });

    for (let index = 0; index < 5; index += 1) {
      expect(await isInquiryRateLimited("ip:request")).toBe(false);
    }
    expect(await isInquiryRateLimited("ip:request")).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(6);
    expect(rpc).toHaveBeenCalledWith("inquiry_rate_limit_hit", {
      p_key: "ip:request",
      p_window_seconds: 15 * 60,
      p_max: 5,
    });
  });

  it("treats different keys independently by passing distinct p_key values to the RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    mocks.getSupabaseAdmin.mockReturnValue({ rpc });

    expect(await isInquiryRateLimited("ip-a:request")).toBe(false);
    expect(await isInquiryRateLimited("ip-b:request")).toBe(false);
    expect(rpc).toHaveBeenNthCalledWith(1, "inquiry_rate_limit_hit", expect.objectContaining({ p_key: "ip-a:request" }));
    expect(rpc).toHaveBeenNthCalledWith(2, "inquiry_rate_limit_hit", expect.objectContaining({ p_key: "ip-b:request" }));
  });

  it("fails closed (throws) when the RPC call itself errors, rather than allowing the request through", async () => {
    mocks.getSupabaseAdmin.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("connection reset") }),
    });
    await expect(isInquiryRateLimited("ip:request")).rejects.toBeInstanceOf(RateLimitCheckFailedError);
  });

  it("fails closed when Supabase is not configured", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    await expect(isInquiryRateLimited("ip:request")).rejects.toBeInstanceOf(RateLimitCheckFailedError);
  });
});
