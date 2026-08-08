import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGenerationRecord: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ getGenerationRecord: mocks.getGenerationRecord }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

import { InquiryHashSaltMissingError, resolveInquiryHashSalt, savePublicInquiry, type PublicInquiryInput } from "@/lib/inquiries";

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

describe("resolveInquiryHashSalt", () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns undefined when unset", () => {
    delete process.env.INQUIRY_HASH_SALT;
    expect(resolveInquiryHashSalt()).toBeUndefined();
  });

  it("returns undefined when empty", () => {
    process.env.INQUIRY_HASH_SALT = "";
    expect(resolveInquiryHashSalt()).toBeUndefined();
  });

  it("returns undefined when whitespace-only", () => {
    process.env.INQUIRY_HASH_SALT = "   ";
    expect(resolveInquiryHashSalt()).toBeUndefined();
  });

  it("returns the trimmed value when set", () => {
    process.env.INQUIRY_HASH_SALT = "  a-real-salt-value  ";
    expect(resolveInquiryHashSalt()).toBe("a-real-salt-value");
  });
});

describe("savePublicInquiry salt handling (defense in depth)", () => {
  beforeEach(() => {
    mocks.getGenerationRecord.mockReset().mockResolvedValue({ brief: { storeName: "BB-Coffee" } });
    mocks.getSupabaseAdmin.mockReset().mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }),
    });
  });

  it("throws InquiryHashSaltMissingError when called with an empty salt", async () => {
    await expect(savePublicInquiry(input, "203.0.113.1", "")).rejects.toBeInstanceOf(InquiryHashSaltMissingError);
  });

  it("succeeds when called with a non-empty salt", async () => {
    await expect(savePublicInquiry(input, "203.0.113.1", "a-real-salt-value")).resolves.toBeDefined();
  });

  it("the source file never contains the hardcoded fallback string 'local-development'", () => {
    const source = readFileSync(new URL("../src/lib/inquiries.ts", import.meta.url), "utf8");
    expect(source).not.toContain("local-development");
  });

  it("the source file never reads NEUMOS_API_KEY as an IP-hash fallback", () => {
    const source = readFileSync(new URL("../src/lib/inquiries.ts", import.meta.url), "utf8");
    expect(source).not.toContain("NEUMOS_API_KEY");
  });
});
