import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as generatePOST } from "@/app/api/generate/route";
import { POST as v1ContentsPOST } from "@/app/v1/contents/route";
import { GET as v1ContentsStatusGET } from "@/app/v1/contents/[requestId]/route";

const brief = {
  storeName: "整体院 結",
  industry: "整体院",
  area: "宜野湾市",
  targetCustomer: "デスクワーク中心の30-50代",
  mainProblem: "肩こり・腰痛の慢性患者からの紹介が少ない",
  salesAngle: "根本改善を重視した施術方針",
  websiteGoal: "初回予約の増加",
  siteConcept: "身体の根本から整える整体院",
  recommendedPages: ["トップ", "施術メニュー", "アクセス", "お客様の声"],
  seoKeywords: ["宜野湾市 整体", "肩こり 根本改善"],
  tone: "誠実・信頼感",
  offer: "初回カウンセリング無料",
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer test-neumos-api-key",
    },
    body: JSON.stringify(body),
  }));
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.NEUMOS_API_KEY = "test-neumos-api-key";
  });

  it("returns 200 with requestId/status/previewUrl/generatedContents for website", async () => {
    const req = jsonRequest("http://localhost:3100/api/generate", { generationType: "website", brief });
    const res = await generatePOST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.requestId).toBeTruthy();
    expect(json.status).toBe("preview");
    expect(json.previewUrl).toContain(`/preview/${json.requestId}`);
    expect(json.publishedUrl).toBeNull();
    // 業種別のヒーローコピー（CV重視）はstoreNameを含むとは限らない
    expect(json.generatedContents.heroTitle.length).toBeGreaterThan(0);
  });

  it("returns 400 for an invalid brief", async () => {
    const req = jsonRequest("http://localhost:3100/api/generate", {
      generationType: "website",
      brief: { storeName: "" },
    });
    const res = await generatePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 501 for a not-yet-implemented generationType", async () => {
    const req = jsonRequest("http://localhost:3100/api/generate", { generationType: "faq", brief });
    const res = await generatePOST(req);
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.implementedGenerationTypes).toEqual(["website"]);
  });
});

describe("MVP bridge: POST /v1/contents + GET /v1/contents/:requestId (NOT under /api — must match MVP's client.ts + neumos-live.test.ts contract)", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.NEUMOS_API_KEY = "test-neumos-api-key";
  });

  it("submits a generation job and returns a status pollable via GET", async () => {
    const submitReq = jsonRequest("http://localhost:3100/v1/contents", {
      generationType: "website",
      brief,
    });
    const submitRes = await v1ContentsPOST(submitReq);
    expect(submitRes.status).toBe(200);
    const submitJson = await submitRes.json();
    expect(submitJson.status).toBe("preview");
    expect(Array.isArray(submitJson.generatedContents)).toBe(true);
    expect(submitJson.generatedContents[0]).toHaveProperty("type");

    const statusRes = await v1ContentsStatusGET(
      new NextRequest(new Request(`http://localhost:3100/v1/contents/${submitJson.requestId}`, {
        headers: { authorization: "Bearer test-neumos-api-key" },
      })),
      { params: { requestId: submitJson.requestId } }
    );
    expect(statusRes.status).toBe(200);
    const statusJson = await statusRes.json();
    expect(statusJson.requestId).toBe(submitJson.requestId);
    expect(statusJson.status).toBe("preview");
  });
});
