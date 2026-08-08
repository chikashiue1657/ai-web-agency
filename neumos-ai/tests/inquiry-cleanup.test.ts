import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

import {
  INQUIRY_RETENTION_DAYS,
  InquiryStorageUnavailableError,
  InquiryTableUnavailableError,
  cleanupExpiredInquiries,
} from "@/lib/inquiry-cleanup";

function fakeAdmin(deleteResult: { count: number | null; error: unknown }) {
  const lt = vi.fn().mockResolvedValue(deleteResult);
  const del = vi.fn().mockReturnValue({ lt });
  const from = vi.fn().mockReturnValue({ delete: del });
  return { client: { from }, from, del, lt };
}

describe("cleanupExpiredInquiries", () => {
  beforeEach(() => {
    mocks.getSupabaseAdmin.mockReset();
  });

  it("throws when Supabase is not configured", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(null);
    await expect(cleanupExpiredInquiries()).rejects.toBeInstanceOf(InquiryStorageUnavailableError);
  });

  it("deletes only rows older than the 180-day cutoff, requesting an exact count and no row data", async () => {
    const { client, from, del, lt } = fakeAdmin({ count: 2, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);

    const now = new Date("2026-08-09T00:00:00.000Z");
    const result = await cleanupExpiredInquiries(now);

    expect(from).toHaveBeenCalledWith("neumos_site_inquiries");
    expect(del).toHaveBeenCalledWith({ count: "exact" });
    const expectedCutoff = new Date(now.getTime() - INQUIRY_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(lt).toHaveBeenCalledWith("created_at", expectedCutoff);
    expect(result).toEqual({ deleted: 2, cutoff: expectedCutoff });
  });

  it("reports large delete counts exactly, without ever materializing a per-row ID array (e.g. 1001 rows)", async () => {
    const { client } = fakeAdmin({ count: 1001, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(1001);
  });

  it("treats a null count with no error as zero deleted (does not crash or return undefined)", async () => {
    const { client } = fakeAdmin({ count: null, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(0);
  });

  it("is idempotent: rerunning with nothing left to delete reports zero and no error", async () => {
    const { client } = fakeAdmin({ count: 0, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(0);
  });

  it("treats a not-yet-provisioned table (42P01) as a failure, not a successful no-op", async () => {
    const { client } = fakeAdmin({ count: null, error: { code: "42P01", message: "relation does not exist" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    await expect(cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"))).rejects.toBeInstanceOf(
      InquiryTableUnavailableError
    );
  });

  it("does not report a successful deleted/cutoff result on 42P01", async () => {
    const { client } = fakeAdmin({ count: null, error: { code: "42P01", message: "relation does not exist" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    let caught: unknown;
    try {
      await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InquiryTableUnavailableError);
    expect((caught as Error).message).not.toContain("relation does not exist");
  });

  it("propagates other database errors so failures stay detectable", async () => {
    const { client } = fakeAdmin({ count: null, error: { code: "53300", message: "too many connections" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    await expect(cleanupExpiredInquiries(new Date())).rejects.toMatchObject({ code: "53300" });
  });

  it("never returns a successful count when the database reports an error", async () => {
    const { client } = fakeAdmin({ count: 5, error: { code: "53300", message: "too many connections" } });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    await expect(cleanupExpiredInquiries(new Date())).rejects.toMatchObject({ code: "53300" });
  });

  it("filters with strict less-than (not less-than-or-equal), so a row created exactly at the cutoff is retained", async () => {
    const { client, lt } = fakeAdmin({ count: 0, error: null });
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
    const { client } = fakeAdmin({ count: 0, error: null });
    mocks.getSupabaseAdmin.mockReturnValue(client);
    const result = await cleanupExpiredInquiries(new Date("2026-08-09T00:00:00.000Z"));
    expect(result.deleted).toBe(0);
  });
});
