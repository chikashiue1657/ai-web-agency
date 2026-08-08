import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { checkInquiryCleanupCronAuth } from "@/lib/inquiry-cleanup-auth";

function request(authorization?: string) {
  return new NextRequest("http://localhost/api/internal/inquiries/cleanup", {
    headers: authorization ? { authorization } : {},
  });
}

describe("checkInquiryCleanupCronAuth", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "cron-secret-value";
    delete process.env.NEUMOS_API_KEY;
    delete process.env.INQUIRY_HASH_SALT;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEUMOS_API_KEY;
    delete process.env.INQUIRY_HASH_SALT;
  });

  it("fails closed with 404 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(checkInquiryCleanupCronAuth(request("Bearer x"))).toEqual({ authorized: false, status: 404 });
  });

  it("returns 401 for a missing bearer token", () => {
    expect(checkInquiryCleanupCronAuth(request())).toEqual({ authorized: false, status: 401 });
  });

  it("returns 401 for a wrong bearer token", () => {
    expect(checkInquiryCleanupCronAuth(request("Bearer wrong"))).toEqual({ authorized: false, status: 401 });
  });

  it("authorizes the correct bearer token", () => {
    expect(checkInquiryCleanupCronAuth(request("Bearer cron-secret-value"))).toEqual({ authorized: true });
  });

  it("fails closed with 503 when CRON_SECRET reuses NEUMOS_API_KEY", () => {
    process.env.NEUMOS_API_KEY = "cron-secret-value";
    expect(checkInquiryCleanupCronAuth(request("Bearer cron-secret-value"))).toEqual({
      authorized: false,
      status: 503,
    });
  });

  it("fails closed with 503 when CRON_SECRET reuses INQUIRY_HASH_SALT", () => {
    process.env.INQUIRY_HASH_SALT = "cron-secret-value";
    expect(checkInquiryCleanupCronAuth(request("Bearer cron-secret-value"))).toEqual({
      authorized: false,
      status: 503,
    });
  });

  it("does not authorize just because the request happens to omit Authorization entirely while secrets collide", () => {
    process.env.NEUMOS_API_KEY = "cron-secret-value";
    expect(checkInquiryCleanupCronAuth(request())).toEqual({ authorized: false, status: 503 });
  });
});
