import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  savePublicInquiry: vi.fn(),
  sendInquiryNotification: vi.fn(),
}));

vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  savePublicInquiry: mocks.savePublicInquiry,
}));
vi.mock("@/lib/inquiry-notification", () => ({ sendInquiryNotification: mocks.sendInquiryNotification }));

import { POST } from "@/app/api/public/inquiries/route";
import { resetInquiryRateLimitForTests } from "@/lib/inquiry-rate-limit";

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
    resetInquiryRateLimitForTests();
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

  it("rate limits repeated submissions for one visitor and request", async () => {
    for (let index = 0; index < 5; index += 1) expect((await POST(request({ ...body, message: `message-${index}` }))).status).toBe(201);
    expect((await POST(request({ ...body, message: "sixth" }))).status).toBe(429);
  });
});
