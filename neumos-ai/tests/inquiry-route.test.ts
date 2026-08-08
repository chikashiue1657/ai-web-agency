import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  savePublicInquiry: vi.fn(),
  sendInquiryNotification: vi.fn(),
  isInquiryRateLimited: vi.fn(),
}));

vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  savePublicInquiry: mocks.savePublicInquiry,
}));
vi.mock("@/lib/inquiry-notification", () => ({ sendInquiryNotification: mocks.sendInquiryNotification }));
vi.mock("@/lib/inquiry-rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiry-rate-limit")>()),
  isInquiryRateLimited: mocks.isInquiryRateLimited,
}));

import { POST } from "@/app/api/public/inquiries/route";
import { RateLimitCheckFailedError } from "@/lib/inquiry-rate-limit";

const body = {
  requestId: "97e73c6c-520e-48d9-8e04-c152c42baf9d",
  inquiryType: "reservation",
  name: "山田 太郎",
  email: "taro@example.com",
  phone: "",
  preferredDate: "2026-08-10",
  message: "2名で予約できますか",
  consent: true,
  website: "",
  startedAt: Date.now() - 3_000,
};

function request(payload: unknown = body, ip = "203.0.113.1") {
  return new NextRequest("http://localhost/api/public/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/public/inquiries", () => {
  beforeEach(() => {
    process.env.INQUIRY_ENABLED = "true";
    process.env.INQUIRY_HASH_SALT = "a-sufficiently-random-salt-value";
    mocks.isInquiryRateLimited.mockReset().mockResolvedValue(false);
    mocks.savePublicInquiry.mockReset().mockResolvedValue({
      id: "inquiry-1",
      requestId: body.requestId,
      storeName: "BB-Coffee",
      inquiryType: "reservation",
      name: body.name,
      email: body.email,
      preferredDate: body.preferredDate,
      message: body.message,
      status: "new",
      createdAt: new Date().toISOString(),
    });
    mocks.sendInquiryNotification.mockReset().mockResolvedValue("sent");
  });
  afterEach(() => {
    delete process.env.INQUIRY_ENABLED;
    delete process.env.INQUIRY_HASH_SALT;
  });

  it("saves a valid inquiry and prevents caching", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.savePublicInquiry).toHaveBeenCalledOnce();
    expect(mocks.sendInquiryNotification).toHaveBeenCalledOnce();
  });

  it("rejects invalid input before storage", async () => {
    const response = await POST(request({ ...body, email: "", phone: "" }));
    expect(response.status).toBe(400);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("silently accepts an unrealistically fast bot submission", async () => {
    const response = await POST(request({ ...body, startedAt: Date.now() }));
    expect(response.status).toBe(202);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("silently accepts a populated honeypot without storing it", async () => {
    const response = await POST(request({ ...body, website: "https://spam.example" }));
    expect(response.status).toBe(202);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("returns 429 when the rate limiter reports the limit hit", async () => {
    mocks.isInquiryRateLimited.mockResolvedValue(true);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the rate limit check itself fails (does not silently allow through)", async () => {
    mocks.isInquiryRateLimited.mockRejectedValue(new RateLimitCheckFailedError("db unreachable"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized body instead of buffering it fully", async () => {
    const response = await POST(request({ ...body, message: "x".repeat(25_000) }));
    expect(response.status).toBe(413);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
  });

  it("returns 404 when INQUIRY_ENABLED is not 'true'", async () => {
    delete process.env.INQUIRY_ENABLED;
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mocks.savePublicInquiry).not.toHaveBeenCalled();
    expect(mocks.isInquiryRateLimited).not.toHaveBeenCalled();
  });
});
