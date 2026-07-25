import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as modelsGET } from "@/app/api/admin/brand-director/models/route";
import { POST as analyzePOST } from "@/app/api/admin/brand-director/analyze/route";

const TEST_TOKEN = "test-diagnostic-token-1234567890";

function getRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }));
}

function postRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL_STANDARD",
  "OPENAI_MODEL_PREMIUM",
  "OPENAI_MODEL_VISION",
  "OPENAI_TIMEOUT_MS",
  "BRAND_DIRECTOR_DIAGNOSTIC_TOKEN",
] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/admin/brand-director/models: 認可", () => {
  it("秘密トークン無しでは401（本文にモデル情報を含まない）", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(getRequest("http://localhost:3100/api/admin/brand-director/models"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.available).toBeUndefined();
  });

  it("トークンが不一致なら401", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": "wrong-token" })
    );
    expect(res.status).toBe(401);
  });

  it("BRAND_DIRECTOR_DIAGNOSTIC_TOKEN自体が未設定なら、正しそうな値を送っても401", async () => {
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/brand-director/models: モデル利用可否", () => {
  beforeEach(() => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    process.env.OPENAI_API_KEY = "sk-test-dummy";
  });

  it("一覧取得成功時、対象モデルのあり/なしを真偽値で返す（一覧全文は返さない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "gpt-5.6-luna" }, { id: "gpt-5.6-terra" }, { id: "some-other-model" }],
        }),
      })
    );

    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toEqual({ "gpt-5.6-luna": true, "gpt-5.6-terra": true, "gpt-5.6-sol": false });
    expect(json.data).toBeUndefined();
  });

  it("OPENAI_API_KEY未設定なら502（fetchを呼ばない）", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("OpenAI側が認証失敗(401)を返した場合は502（本文詳細は返さない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("HTTP 429の場合も502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }));
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(502);
  });

  it("HTTP 500の場合も502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(502);
  });

  it("タイムアウト時も502（例外を漏らさない）", async () => {
    process.env.OPENAI_TIMEOUT_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      })
    );
    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(502);
  }, 10000);

  it("APIキーの値はレスポンス・ログのどちらにも出ない", async () => {
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));

    const res = await modelsGET(
      getRequest("http://localhost:3100/api/admin/brand-director/models", { "x-diagnostic-token": TEST_TOKEN })
    );
    const bodyText = JSON.stringify(await res.json());
    const loggedText = warnSpy.mock.calls.flat().map((v) => JSON.stringify(v)).join(" ");
    expect(bodyText).not.toContain("sk-test-SECRET-VALUE");
    expect(loggedText).not.toContain("sk-test-SECRET-VALUE");
    warnSpy.mockRestore();
  });
});

describe("POST /api/admin/brand-director/analyze: 認可", () => {
  it("秘密トークン無しでは401", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await analyzePOST(postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/brand-director/analyze: BrandPlan取得（mock fetch）", () => {
  const validBrandPlanWithPhoto = {
    brandArchetype: "artisan",
    industry: "cafe",
    audiences: ["地元客"],
    customerIntent: "新規客の獲得が伸び悩んでいる",
    moodKeywords: ["落ち着いた・上質", "静かな時間", "本日の一杯"],
    valueProposition: "落ち着いた店内体験",
    visualDirection: { paletteHint: "warm", typographyTone: "clean-sans", photoTreatment: "framed" },
    copyDirection: { tone: "落ち着いた・上質", emphasis: "atmosphere" },
    layoutVariant: "direct",
    photoAssignments: [
      { photoUrl: "https://example.com/secret-photo.jpg", role: "hero", qualityScore: 80, rejectionReason: null },
    ],
    ctaStrategy: { placement: "hero", urgency: "medium" },
    confidence: 0.7,
    evidence: [{ field: "moodKeywords", basis: "brief", detail: "brief.toneより" }],
  };

  beforeEach(() => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    process.env.OPENAI_MODEL_VISION = "test-vision-model";
  });

  it("正常応答: BrandPlanを取得しphotoUrlはラベルへ置き換えて返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlanWithPhoto), usage: { input_tokens: 10, output_tokens: 5 } }),
      })
    );

    const res = await analyzePOST(
      postRequest(
        "http://localhost:3100/api/admin/brand-director/analyze",
        { photoUrl: "https://example.com/secret-photo.jpg" },
        { "x-diagnostic-token": TEST_TOKEN }
      )
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("openai");
    expect(json.schemaValid).toBe(true);
    expect(json.fallbackReason).toBeNull();
    expect(json.plan.photoAssignments[0].photoUrl).toBe("photo#1");
    const bodyText = JSON.stringify(json);
    expect(bodyText).not.toContain("secret-photo.jpg");
  });

  it("refusalの場合はrule-providerへフォールバックし、schemaValidはtrueのまま", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output: [{ type: "message", content: [{ type: "refusal", refusal: "cannot comply" }] }] }),
      })
    );

    const res = await analyzePOST(
      postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}, { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fallbackReason).toContain("refus");
    expect(json.schemaValid).toBe(true);
  });

  it("incompleteの場合はrule-providerへフォールバックする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
      })
    );

    const res = await analyzePOST(
      postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}, { "x-diagnostic-token": TEST_TOKEN })
    );
    const json = await res.json();
    expect(json.fallbackReason).toContain("incomplete");
    expect(json.schemaValid).toBe(true);
  });

  it("Schema不一致の場合はrule-providerへフォールバックする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify({ nonsense: true }) }) })
    );

    const res = await analyzePOST(
      postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}, { "x-diagnostic-token": TEST_TOKEN })
    );
    const json = await res.json();
    expect(json.fallbackReason).toContain("schema");
    expect(json.schemaValid).toBe(true);
  });

  it("HTTP 500の場合もrule-providerへ安全にフォールバックする（例外を漏らさない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }));

    const res = await analyzePOST(
      postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}, { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("openai");
    expect(json.fallbackReason).toContain("500");
    expect(json.schemaValid).toBe(true);
  });

  it("APIキー・Authorizationヘッダー・内部プロンプトはレスポンスに含まれない", async () => {
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlanWithPhoto) }),
      })
    );

    const res = await analyzePOST(
      postRequest("http://localhost:3100/api/admin/brand-director/analyze", {}, { "x-diagnostic-token": TEST_TOKEN })
    );
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain("sk-test-SECRET-VALUE");
    expect(bodyText).not.toContain("Bearer");
    expect(bodyText).not.toContain("Brand Director です"); // system prompt本文の断片
  });
});
