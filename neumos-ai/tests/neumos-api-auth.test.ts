import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkNeumosApiAuth } from "@/lib/neumos-api-auth";

const generationMocks = vi.hoisted(() => ({
  performGeneration: vi.fn(),
  getGenerationRecord: vi.fn(),
}));

vi.mock("@/lib/generate", () => ({
  performGeneration: generationMocks.performGeneration,
}));

vi.mock("@/lib/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/store")>();
  return {
    ...original,
    getGenerationRecord: generationMocks.getGenerationRecord,
  };
});

import { POST as generatePOST } from "@/app/api/generate/route";
import { POST as v1ContentsPOST } from "@/app/v1/contents/route";
import { GET as v1ContentsStatusGET } from "@/app/v1/contents/[requestId]/route";

const SECRET = "test-neumos-secret";
const validBody = {
  generationType: "website",
  brief: {
    storeName: "Test Store",
    industry: "Cafe",
    area: "Tokyo",
    targetCustomer: "Local customers",
    mainProblem: "Needs a website",
    salesAngle: "Quality",
    websiteGoal: "Reservations",
    siteConcept: "Warm",
    recommendedPages: ["Home"],
    seoKeywords: ["Tokyo cafe"],
    tone: "Friendly",
    offer: "Consultation",
  },
};

function postRequest(
  url: string,
  authorization?: string,
  body: unknown = validBody
): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new NextRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(url: string, authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new NextRequest(url, { headers });
}

async function expectAuthError(response: Response, status: 401 | 404) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const text = await response.text();
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain("wrong-secret");
}

describe("Neumos generation API Bearer authentication", () => {
  beforeEach(() => {
    process.env.NEUMOS_API_KEY = SECRET;
    generationMocks.performGeneration.mockReset();
    generationMocks.getGenerationRecord.mockReset();
  });

  afterEach(() => {
    delete process.env.NEUMOS_API_KEY;
    vi.restoreAllMocks();
  });

  it("fails closed with 404 when the server key is unset or empty", async () => {
    delete process.env.NEUMOS_API_KEY;
    await expectAuthError(
      await v1ContentsPOST(postRequest("http://localhost/v1/contents", `Bearer ${SECRET}`)),
      404
    );

    process.env.NEUMOS_API_KEY = "";
    await expectAuthError(
      await generatePOST(postRequest("http://localhost/api/generate", `Bearer ${SECRET}`)),
      404
    );
  });

  it.each([
    ["missing header", undefined],
    ["non-Bearer scheme", `Basic ${SECRET}`],
    ["empty Bearer", "Bearer "],
    ["mismatched token", "Bearer wrong-secret"],
  ])("returns 401 for %s", async (_label, authorization) => {
    await expectAuthError(
      await v1ContentsPOST(postRequest("http://localhost/v1/contents", authorization)),
      401
    );
  });

  it("accepts only an exact Bearer token from the Authorization header", () => {
    expect(
      checkNeumosApiAuth(getRequest("http://localhost/v1/contents", `Bearer ${SECRET}`))
    ).toEqual({ authorized: true });
    expect(
      checkNeumosApiAuth(getRequest(`http://localhost/v1/contents?token=${SECRET}`))
    ).toEqual({ authorized: false, status: 401 });
  });

  it("does not authenticate from query parameters or the JSON body", async () => {
    await expectAuthError(
      await v1ContentsPOST(
        postRequest(`http://localhost/v1/contents?token=${SECRET}`, undefined, {
          ...validBody,
          token: SECRET,
        })
      ),
      401
    );
    expect(generationMocks.performGeneration).not.toHaveBeenCalled();
  });

  it("protects POST /api/generate before reading JSON or generating", async () => {
    const malformed = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    await expectAuthError(await generatePOST(malformed), 401);
    expect(generationMocks.performGeneration).not.toHaveBeenCalled();
  });

  it("protects GET status before reading a generation record", async () => {
    await expectAuthError(
      await v1ContentsStatusGET(
        getRequest("http://localhost/v1/contents/request-1"),
        { params: { requestId: "request-1" } }
      ),
      401
    );
    expect(generationMocks.getGenerationRecord).not.toHaveBeenCalled();
  });

  it("does not log or return the secret on authentication failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await generatePOST(
      postRequest("http://localhost/api/generate", "Bearer wrong-secret")
    );
    await expectAuthError(response, 401);

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
