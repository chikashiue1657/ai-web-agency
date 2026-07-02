import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { submitContentGeneration, getContentGenerationStatus } from "@/lib/neumos/client";
import type { NeumosBrief } from "@/lib/types";

/**
 * モックのノイモスAIサーバを立て、実HTTP経路（POST/GET・ヘッダ・レスポンスマッピング）を検証する。
 * ローカルhttpのみで外部依存なし。
 */
let server: Server;
let baseUrl = "";
let lastAuth = "";
let lastBody: unknown = null;

const brief: NeumosBrief = {
  storeName: "海風食堂",
  industry: "飲食店",
  area: "那覇市",
  targetCustomer: "地域客",
  mainProblem: "HP無し",
  salesAngle: "予約導線",
  websiteGoal: "予約獲得",
  siteConcept: "料理の魅力",
  recommendedPages: ["TOP", "メニュー"],
  seoKeywords: ["那覇市 飲食店"],
  tone: "温かみ",
  offer: "HP制作",
  generationType: "website",
};

beforeAll(async () => {
  server = createServer((req, res) => {
    lastAuth = req.headers["authorization"] ?? "";
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (req.method === "POST" && req.url === "/v1/contents") {
        lastBody = raw ? JSON.parse(raw) : null;
        res.end(
          JSON.stringify({ requestId: "req_abc", status: "processing" })
        );
        return;
      }
      if (req.method === "GET" && req.url === "/v1/contents/req_abc") {
        res.end(
          JSON.stringify({
            requestId: "req_abc",
            status: "ready",
            previewUrl: "https://preview.example/req_abc",
            publishedUrl: "https://umikaze.example",
            generatedContents: [{ type: "page", title: "TOP", url: "https://preview.example/top" }],
          })
        );
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "not found" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
  process.env.NEUMOS_API_URL = baseUrl;
  process.env.NEUMOS_API_KEY = "test-key";
});

afterAll(async () => {
  delete process.env.NEUMOS_API_URL;
  delete process.env.NEUMOS_API_KEY;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Neumos 実HTTP連携（モックサーバ）", () => {
  it("submit は brief をPOSTし requestId/status を正規化して返す", async () => {
    const r = await submitContentGeneration(brief);
    expect(lastAuth).toBe("Bearer test-key");
    expect((lastBody as { generationType?: string }).generationType).toBe("website");
    expect(r.requestId).toBe("req_abc");
    expect(r.status).toBe("generating"); // processing → generating
  });

  it("status取得は preview/published/generatedContents をマッピングして返す", async () => {
    const r = await getContentGenerationStatus("req_abc");
    expect(r.status).toBe("preview"); // ready → preview
    expect(r.previewUrl).toBe("https://preview.example/req_abc");
    expect(r.publishedUrl).toBe("https://umikaze.example");
    expect(r.generatedContents?.[0]?.title).toBe("TOP");
  });

  it("パスが /v1/contents からズレていると(例: /api/v1/contents 誤設定)失敗として扱われる", async () => {
    // NEUMOS_API_URLにパスを足してしまう典型的な誤設定を再現する。
    // submitContentGenerationは常に `${NEUMOS_API_URL}/v1/contents` を叩くため、
    // ベースに /api を含めると実際には /api/v1/contents を叩いてしまい、
    // このモックサーバには存在しないパスとなって404で失敗する。
    const misconfigured = `${baseUrl}/api`;
    process.env.NEUMOS_API_URL = misconfigured;
    try {
      const r = await submitContentGeneration(brief);
      expect(r.status).toBe("failed");
      expect(r.error).toContain("404");
    } finally {
      process.env.NEUMOS_API_URL = baseUrl;
    }
  });
});

describe("エラー時にresponse.text()をそのまま(切り詰めずに)返す", () => {
  it("200文字を超える長いエラー本文もそのまま error に含める", async () => {
    const longBody = "E".repeat(400);
    const errServer = createServer((req, res) => {
      res.statusCode = 500;
      res.end(longBody);
    });
    await new Promise<void>((resolve) => errServer.listen(0, resolve));
    const addr = errServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;

    process.env.NEUMOS_API_URL = `http://127.0.0.1:${port}`;
    process.env.NEUMOS_API_KEY = "test-key";
    try {
      const r = await submitContentGeneration(brief);
      expect(r.status).toBe("failed");
      expect(r.error).toContain(longBody); // 従来の200文字切り詰めが復活していないことを保証
    } finally {
      process.env.NEUMOS_API_URL = baseUrl;
      await new Promise<void>((resolve) => errServer.close(() => resolve()));
    }
  });
});
