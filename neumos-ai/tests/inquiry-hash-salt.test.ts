import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGenerationRecord: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ getGenerationRecord: mocks.getGenerationRecord }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

import { InquiryHashSaltMissingError, savePublicInquiry, type PublicInquiryInput } from "@/lib/inquiries";

const input: PublicInquiryInput = {
  requestId: "97e73c6c-520e-48d9-8e04-c152c42baf9d",
  inquiryType: "reservation",
  name: "山田 太郎",
  email: "taro@example.com",
  message: "2名で予約できますか",
  consent: true,
  website: "",
  startedAt: Date.now() - 3_000,
};

describe("INQUIRY_HASH_SALT fail-closed behavior", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    mocks.getGenerationRecord.mockReset().mockResolvedValue({ brief: { storeName: "BB-Coffee" } });
    mocks.getSupabaseAdmin.mockReset().mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
    });
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("throws InquiryHashSaltMissingError when INQUIRY_HASH_SALT is unset", async () => {
    delete process.env.INQUIRY_HASH_SALT;
    delete process.env.NEUMOS_API_KEY;
    await expect(savePublicInquiry(input, "203.0.113.1")).rejects.toBeInstanceOf(InquiryHashSaltMissingError);
  });

  it("does not fall back to NEUMOS_API_KEY even when it is set", async () => {
    delete process.env.INQUIRY_HASH_SALT;
    process.env.NEUMOS_API_KEY = "some-other-secret-used-for-bearer-auth";
    await expect(savePublicInquiry(input, "203.0.113.1")).rejects.toBeInstanceOf(InquiryHashSaltMissingError);
  });

  it("succeeds once INQUIRY_HASH_SALT is set", async () => {
    process.env.INQUIRY_HASH_SALT = "a-sufficiently-random-salt-value";
    await expect(savePublicInquiry(input, "203.0.113.1")).resolves.toBeDefined();
  });

  it("the source file never contains the hardcoded fallback string 'local-development'", () => {
    const source = readFileSync(new URL("../src/lib/inquiries.ts", import.meta.url), "utf8");
    expect(source).not.toContain("local-development");
  });
});
