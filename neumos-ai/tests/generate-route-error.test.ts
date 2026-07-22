import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Supabase書き込みが失敗した場合（例: schema.sqlが未適用でテーブルが存在しない、
 * PGRST205相当）に、POST /v1/contents や /api/generate が
 * 「generation failed」とだけ返す（詳細不明）のではなく、
 * errorDetailに実際のPostgrestエラー（message/code/details/hint）を
 * そのまま含めて返すことを検証する。
 */

function fakeFailingSupabaseAdmin() {
  return {
    from(_table: string) {
      return {
        upsert() {
          return Promise.resolve({
            error: {
              message: "Could not find the table 'public.neumos_content_generation_requests' in the schema cache",
              code: "PGRST205",
              details: null,
              hint: "Perhaps you meant the table 'public.stores'",
            },
          });
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdmin: vi.fn(() => fakeFailingSupabaseAdmin()),
  getSupabaseProjectRef: vi.fn(() => "test-project-ref"),
}));

const brief = {
  storeName: "テスト整体院",
  industry: "整体院",
  area: "浦添市",
  targetCustomer: "デスクワーク層",
  mainProblem: "紹介以外の流入が無い",
  salesAngle: "根本改善",
  websiteGoal: "予約増加",
  siteConcept: "信頼感",
  recommendedPages: ["トップ"],
  seoKeywords: ["浦添市 整体"],
  tone: "誠実",
  offer: "初回無料相談",
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("Supabase書き込み失敗時、POST /v1/contents と /api/generate は詳細付きの500を返す", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("POST /v1/contents: errorDetailにPostgrestのcode/messageがそのまま入る", async () => {
    const { POST } = await import("@/app/v1/contents/route");
    const req = jsonRequest("http://localhost:3100/v1/contents", { generationType: "website", brief });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("generation failed");
    expect(json.errorDetail.code).toBe("PGRST205");
    expect(json.errorDetail.message).toContain("content_generation_requests");
    expect(json.errorDetail.hint).toContain("public.stores");
  });

  it("POST /api/generate: errorDetailにPostgrestのcode/messageがそのまま入る", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const req = jsonRequest("http://localhost:3100/api/generate", { generationType: "website", brief });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("generation failed");
    expect(json.errorDetail.code).toBe("PGRST205");
  });
});
