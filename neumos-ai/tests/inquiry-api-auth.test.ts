import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ listInquiries: vi.fn() }));
vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  listInquiries: mocks.listInquiries,
}));

import { GET } from "@/app/v1/inquiries/route";

describe("GET /v1/inquiries authentication", () => {
  beforeEach(() => {
    process.env.NEUMOS_API_KEY = "inquiry-api-secret";
    mocks.listInquiries.mockReset().mockResolvedValue([]);
  });
  afterEach(() => delete process.env.NEUMOS_API_KEY);

  it("fails closed with 404 when the server key is missing", async () => {
    delete process.env.NEUMOS_API_KEY;
    const response = await GET(new NextRequest("http://localhost/v1/inquiries"));
    expect(response.status).toBe(404);
    expect(mocks.listInquiries).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or invalid token", async () => {
    expect((await GET(new NextRequest("http://localhost/v1/inquiries"))).status).toBe(401);
    const invalid = new NextRequest("http://localhost/v1/inquiries", { headers: { authorization: "Bearer wrong" } });
    expect((await GET(invalid)).status).toBe(401);
    expect(mocks.listInquiries).not.toHaveBeenCalled();
  });

  it("returns inquiries for the valid Bearer token without caching", async () => {
    const valid = new NextRequest("http://localhost/v1/inquiries", {
      headers: { authorization: "Bearer inquiry-api-secret" },
    });
    const response = await GET(valid);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.listInquiries).toHaveBeenCalledWith(100);
  });
});
