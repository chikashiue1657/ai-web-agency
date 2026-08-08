import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  savePublicInquiry: vi.fn(),
  isInquiryRateLimited: vi.fn(),
  getGenerationRecord: vi.fn(),
}));

vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  savePublicInquiry: mocks.savePublicInquiry,
}));
vi.mock("@/lib/inquiry-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiry-rate-limit")>()),
  isInquiryRateLimited: mocks.isInquiryRateLimited,
}));
vi.mock("@/lib/store", () => ({ getGenerationRecord: mocks.getGenerationRecord }));

import { POST } from "@/app/api/public/inquiries/route";

const body = {
  requestId: "97e73c6c-520e-48d9-8e04-c152c42baf9d",
  inquiryType: "reservation",
  name: "山田 太郎",
  email: "taro@example.com",
  message: "2名で予約できますか",
  consent: true,
  website: "",
  startedAt: Date.now() - 3_000,
};

function request(payload: unknown = body, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/public/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1", ...headers },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/public/inquiries — INQUIRY_HASH_SALT fail-closed ordering", () => {
  beforeEach(() => {
    process.env.INQUIRY_ENABLED = "true";
    delete process.env.INQUIRY_HASH_SALT;
    mocks.savePublicInquiry.mockReset();
    mocks.isInquiryRateLimited.mockReset();
    mocks.getGenerationRecord.mockReset();
  });
  afterEach(() => {
    delete process.env.INQUIRY_ENABLED;
    delete process.env.INQUIRY_HASH_SALT;
  });

  it("returns 503 for an otherwise-valid body", async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 even for a honeypot-triggering submission", async () => {
    const response = await POST(request({ ...body, website: "https://spam.example" }));
    expect(response.status).toBe(503);
  });

  it("returns 503 even for a too-fast (<2s) submission", async () => {
    const response = await POST(request({ ...body, startedAt: Date.now() }));
    expect(response.status).toBe(503);
  });

  it("returns 503 even for malformed JSON", async () => {
    const malformed = new NextRequest("http://localhost/api/public/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.1" },
      body: "{not valid json",
    });
    const response = await POST(malformed);
    expect(response.status).toBe(503);
  });

  it("returns 503 even for an oversized (>20KB) body", async () => {
    const response = await POST(request({ ...body, message: "x".repeat(25_000) }));
    expect(response.status).toBe(503);
  });

  it("does not read the request body at all", async () => {
    let bodyAccessed = false;
    const fakeRequest = {
      headers: new Headers({ "x-forwarded-for": "203.0.113.1" }),
      get body() {
        bodyAccessed = true;
        return null;
      },
    } as unknown as NextRequest;

    const response = await POST(fakeRequest);
    expect(response.status).toBe(503);
    expect(bodyAccessed).toBe(false);
  });

  it("does not call the rate limit RPC", async () => {
    await POST(request());
    expect(mocks.isInquiryRateLimited).not.toHaveBeenCalled();
  });

  it("does not read the generation record or create an inquiry", async () => {
    await POST(request());
    expect(mocks.getGenerationRecord).not.toHaveBeenCalled();
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });
});
