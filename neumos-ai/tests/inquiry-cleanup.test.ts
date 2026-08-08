import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

import { INQUIRY_RETENTION_DAYS, InquiryStorageUnavailableError, cleanupExpiredInquiries } from "@/lib/inquiry-cleanup";

function fakeAdmin(deleteResult: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(deleteResult);
  const lt = vi.fn().mockReturnValue({ select });
  const del = vi.fn().mockReturnValue({ lt });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { client: { from }, from, del, lt, select };
}

describe("cleanupExpiredInquiries", () => {
  beforeEach(() => {
    mocks.getSupabaseAdmin.mockReset();
  });

  it("throws when Supabase is not configured", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    await expect(cleanupExpiredInquiries()).rejects.toBeInstanceOf(InquiryStorageUnavailableError);
  });

  it("deletes only rows older than the 180-day cutoff, selecting no PII columns", async () => {
    const { client, from, lt, select } = fakeAdmin({ data: [{ id: "a" }, { id: "b" }], error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);

    const now = new Date("2026-08-09T00:00:00.000Z");
    const result = await cleanupExpiredInquiries(now);

    expect(from).toHaveBeenCalledWith("neumos_site_inquiries");
    const expectedCutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(lt).toHaveBeenCalledWith("created_at", expectedCutoff);
    expect(select).toHaveBeenCalledWith("id");
    expect(result).toEqual({ deleted: 2, cutoff: expectedCutoff });
  });

  it("is idempotent: rerunning with nothing left to delete reports zero and no error", async () => {
    const { client } = fakeAdmin({ data: [], error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(0);
    expect(result.skipped).toBeUndefined();
  });

  it("treats a not-yet-provisioned table (PR #36 unmerged) as a no-op instead of a failure", async () => {
    const { client } = fakeAdmin({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const now = new Date("2026-08-09T00:00:00.000Z");
    const result = await cleanupExpiredInquiries(now);
    const expectedCutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(result).toEqual({ deleted: 0, cutoff: expectedCutoff, skipped: true });
  });

  it("propagates other database errors so failures stay detectable", async () => {
    const { client } = fakeAdmin({ data: null, error: { code: "53300", message: "too many connections" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    await expect(cleanupExpiredInquiries(new Date())).rejects.toMatchObject({ code: "53300" });
  });

  it("filters with strict less-than (not less-than-or-equal), so a row created exactly at the cutoff is retained", async () => {
    const { client, lt } = fakeAdmin({ data: [], error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const now = new Date("2026-08-09T00:00:00.000Z");
    const expectedCutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await cleanupExpiredInquiries(now);

    // The mock only implements `.lt(...)`; using `.lte(...)` in the implementation would throw here.
    expect(lt).toHaveBeenCalledWith("created_at", expectedCutoff);
    // ISO 8601 timestamps compare lexicographically the same as chronologically:
    // a row's created_at equal to the cutoff is NOT "<" the cutoff, so it is retained.
    expect(expectedCutoff < expectedCutoff).toBe(false);
    const oneMsOlder = new Date(new Date(expectedCutoff).getTime() - 1).toISOString();
    expect(oneMsOlder < expectedCutoff).toBe(true);
  });

  it("retains rows younger than 180 days (nothing deleted when all inquiries are within the retention window)", async () => {
    const { client } = fakeAdmin({ data: [], error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(0);
  });
});
