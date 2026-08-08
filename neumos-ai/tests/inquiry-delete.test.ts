import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ deleteInquiryById: vi.fn() }));
vi.mock("@/lib/inquiries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inquiries")>()),
  deleteInquiryById: mocks.deleteInquiryById,
}));

import { DELETE } from "@/app/v1/inquiries/[id]/route";
import * as PublicInquiriesRoute from "@/app/api/public/inquiries/route";

const VALID_ID = "97e73c6c-520e-48d9-8e04-c152c42baf9d";

function request(id: string, authorization?: string) {
  return new NextRequest(`http://localhost/v1/inquiries/${id}`, {
    method: "DELETE",
    headers: authorization ? { authorization } : {},
  });
}

describe("DELETE /v1/inquiries/[id]", () => {
  beforeEach(() => {
    process.env.NEUMOS_API_KEY = "inquiry-api-secret";
    mocks.deleteInquiryById.mockReset();
  });
  afterEach(() => delete process.env.NEUMOS_API_KEY);

  it("fails closed with 404 when the server key is missing", async () => {
    delete process.env.NEUMOS_API_KEY;
    const response = await DELETE(request(VALID_ID, "Bearer x"), { params: { id: VALID_ID } });
    expect(response.status).toBe(404);
    expect(mocks.deleteInquiryById).not.toHaveBeenCalled();
  });

  it("returns 401 for a missing or invalid token", async () => {
    const missing = await DELETE(request(VALID_ID), { params: { id: VALID_ID } });
    expect(missing.status).toBe(401);
    const wrong = await DELETE(request(VALID_ID, "Bearer wrong"), { params: { id: VALID_ID } });
    expect(wrong.status).toBe(401);
    expect(mocks.deleteInquiryById).not.toHaveBeenCalled();
  });

  it("rejects an invalid id format before touching storage", async () => {
    const response = await DELETE(request("not-a-uuid", "Bearer inquiry-api-secret"), {
      params: { id: "not-a-uuid" },
    });
    expect(response.status).toBe(400);
    expect(mocks.deleteInquiryById).not.toHaveBeenCalled();
  });

  it("deletes and returns 200 with no PII fields in the response", async () => {
    mocks.deleteInquiryById.mockResolvedValue("deleted");
    const response = await DELETE(request(VALID_ID, "Bearer inquiry-api-secret"), { params: { id: VALID_ID } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["id", "ok"]);
    expect(mocks.deleteInquiryById).toHaveBeenCalledWith(VALID_ID);
  });

  it("returns 404 when the id does not exist", async () => {
    mocks.deleteInquiryById.mockResolvedValue("not_found");
    const response = await DELETE(request(VALID_ID, "Bearer inquiry-api-secret"), { params: { id: VALID_ID } });
    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["error"]);
  });

  it("does not expose PII in storage-error responses either", async () => {
    mocks.deleteInquiryById.mockRejectedValue(new Error("boom"));
    const response = await DELETE(request(VALID_ID, "Bearer inquiry-api-secret"), { params: { id: VALID_ID } });
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["error"]);
  });

  it("the public inquiry capture route has no DELETE handler", () => {
    expect((PublicInquiriesRoute as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
