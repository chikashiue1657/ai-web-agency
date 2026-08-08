import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ cleanupExpiredInquiries: vi.fn() }));
vi.mock("@/lib/inquiry-cleanup", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiry-cleanup")>()),
  cleanupExpiredInquiries: mocks.cleanupExpiredInquiries,
}));

import { GET } from "@/app/api/internal/inquiries/cleanup/route";
import { InquiryStorageUnavailableError } from "@/lib/inquiry-cleanup";

function request(authorization?: string) {
  return new NextRequest("http://localhost/api/internal/inquiries/cleanup", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/internal/inquiries/cleanup", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret-value";
    delete process.env.NEUMOS_API_KEY;
    delete process.env.INQUIRY_HASH_SALT;
    mocks.cleanupExpiredInquiries.mockReset();
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEUMOS_API_KEY;
    delete process.env.INQUIRY_HASH_SALT;
  });

  it("fails closed with 404 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request("Bearer x"));
    expect(response.status).toBe(404);
    expect(mocks.cleanupExpiredInquiries).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or wrong bearer token", async () => {
    const missing = await GET(request());
    expect(missing.status).toBe(401);
    const wrong = await GET(request("Bearer wrong"));
    expect(wrong.status).toBe(401);
    expect(mocks.cleanupExpiredInquiries).not.toHaveBeenCalled();
  });

  it("returns 503 without running cleanup when CRON_SECRET reuses another secret", async () => {
    process.env.NEUMOS_API_KEY = "cron-secret-value";
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(503);
    expect(mocks.cleanupExpiredInquiries).not.toHaveBeenCalled();
  });

  it("runs cleanup and returns a PII-free summary on success", async () => {
    mocks.cleanupExpiredInquiries.mockResolvedValue({ deleted: 3, cutoff: "2026-02-10T00:00:00.000Z" });
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, deleted: 3, cutoff: "2026-02-10T00:00:00.000Z" });
  });

  it("returns 200 with skipped=true when the table is not provisioned yet (PR #36 unmerged)", async () => {
    mocks.cleanupExpiredInquiries.mockResolvedValue({ deleted: 0, cutoff: "2026-02-10T00:00:00.000Z", skipped: true });
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, deleted: 0, cutoff: "2026-02-10T00:00:00.000Z", skipped: true });
  });

  it("returns 503 when inquiry storage is not configured", async () => {
    mocks.cleanupExpiredInquiries.mockRejectedValue(new InquiryStorageUnavailableError());
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(503);
  });

  it("returns 500 without leaking error details on unexpected failure", async () => {
    mocks.cleanupExpiredInquiries.mockRejectedValue(new Error("boom with sensitive detail"));
    const response = await GET(request("Bearer cron-secret-value"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("sensitive detail");
    expect(Object.keys(body).sort()).toEqual(["error", "ok"]);
  });

  it("running cleanup twice in a row is safe (idempotent, no duplicate-deletion errors)", async () => {
    mocks.cleanupExpiredInquiries.mockResolvedValueOnce({ deleted: 3, cutoff: "2026-02-10T00:00:00.000Z" });
    mocks.cleanupExpiredInquiries.mockResolvedValueOnce({ deleted: 0, cutoff: "2026-02-10T00:00:00.000Z" });
    const first = await GET(request("Bearer cron-secret-value"));
    const second = await GET(request("Bearer cron-secret-value"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
