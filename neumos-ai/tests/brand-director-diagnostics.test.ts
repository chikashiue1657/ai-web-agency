import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as modelsGET } from "@/app/api/admin/brand-director/models/route";
import { POST as analyzePOST } from "@/app/api/admin/brand-director/analyze/route";

const MODELS_URL = "http://localhost:3100/api/admin/brand-director/models";
const ANALYZE_URL = "http://localhost:3100/api/admin/brand-director/analyze";

function getRequest(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { headers }));
}

function postRequest(url: string, rawBody: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(url, { method: "POST", headers, body: rawBody }));
}

function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  return postRequest(url, JSON.stringify(body), { "content-type": "application/json", ...headers });
}

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL_STANDARD",
  "OPENAI_MODEL_PREMIUM",
  "OPENAI_MODEL_VISION",
  "OPENAI_TIMEOUT_MS",
  "BRAND_DIRECTOR_DIAGNOSTIC_TOKEN",
] as const;

/** 各テストで固有のトークンを使う（rate-limit.tsはモジュール内メモリ状態を
 * プロセス生存中は保持するため、テスト間で同じ値を使い回すと後続のテストが
 * 想定外に429になってしまう。テストごとに一意な値にして完全に隔離する）。 */
let TEST_TOKEN: string;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
  TEST_TOKEN = `test-diagnostic-token-${randomUUID()}`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const validBrandPlan = {
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

function stubOpenAiEnv() {
  process.env.OPENAI_API_KEY = "sk-test-dummy";
  process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
  process.env.OPENAI_MODEL_VISION = "test-vision-model";
}

// ============================================================
// 認可（fail-closed）
// ============================================================
describe("認可: fail-closed", () => {
  it("BRAND_DIRECTOR_DIAGNOSTIC_TOKEN未設定なら、正しいヘッダーを送っても404（本文なし）", async () => {
    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("トークンヘッダー無しなら401", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(getRequest(MODELS_URL));
    expect(res.status).toBe(401);
  });

  it("トークンヘッダーが空文字なら401", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": "" }));
    expect(res.status).toBe(401);
  });

  it("トークンが不一致なら401", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": `${TEST_TOKEN}-wrong` }));
    expect(res.status).toBe(401);
  });

  it("query parameterだけにトークンを入れても認証されない（ヘッダー必須）", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await modelsGET(getRequest(`${MODELS_URL}?token=${TEST_TOKEN}`));
    expect(res.status).toBe(401);
  });

  it("POST bodyだけにトークンを入れても認証されない（ヘッダー必須・bodyは読まれる前に401）", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const res = await analyzePOST(postJson(ANALYZE_URL, { token: TEST_TOKEN }));
    expect(res.status).toBe(401);
  });

  it("正しいトークンなら通る", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) })
    );
    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
  });
});

// ============================================================
// キャッシュ禁止・noindexヘッダー
// ============================================================
describe("キャッシュ禁止・noindexヘッダー", () => {
  it("認可エラー(404)・(401)・成功時のいずれもCache-ControlとX-Robots-Tagを持つ", async () => {
    const notConfigured = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(notConfigured.headers.get("cache-control")).toBe("no-store");
    expect(notConfigured.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    const unauthorized = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": "wrong" }));
    expect(unauthorized.headers.get("cache-control")).toBe("no-store");
    expect(unauthorized.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));
    const success = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(success.headers.get("cache-control")).toBe("no-store");
    expect(success.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

// ============================================================
// GET /models: モデル利用可否
// ============================================================
describe("GET /api/admin/brand-director/models: モデル利用可否", () => {
  beforeEach(() => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    process.env.OPENAI_API_KEY = "sk-test-dummy";
  });

  it("一覧取得成功時、対象3モデルの真偽値だけを返す（一覧全文・owner等は含まない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: "gpt-5.6-luna", owned_by: "openai", created: 123 },
            { id: "gpt-5.6-terra" },
            { id: "some-other-model" },
          ],
        }),
      })
    );

    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ available: { "gpt-5.6-luna": true, "gpt-5.6-terra": true, "gpt-5.6-sol": false } });
  });

  it("OPENAI_API_KEY未設定なら502（fetchを呼ばない・内部理由は返さない）", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(502);
    expect(fetchMock).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json).toEqual({ error: "model_availability_check_failed" });
  });

  it("OpenAI側401/403/429/5xxはすべて502・詳細を返さない", async () => {
    for (const status of [401, 403, 429, 500]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }));
      const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json).toEqual({ error: "model_availability_check_failed" });
    }
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
    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(502);
  }, 10000);

  it("APIキーの値はレスポンス・ログのどちらにも出ない", async () => {
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));

    const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
    const bodyText = JSON.stringify(await res.json());
    const loggedText = warnSpy.mock.calls.flat().map((v) => JSON.stringify(v)).join(" ");
    expect(bodyText).not.toContain("sk-test-SECRET-VALUE");
    expect(loggedText).not.toContain("sk-test-SECRET-VALUE");
    warnSpy.mockRestore();
  });
});

// ============================================================
// POST /analyze: 入力制限
// ============================================================
describe("POST /api/admin/brand-director/analyze: 入力制限", () => {
  beforeEach(() => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    stubOpenAiEnv();
  });

  it("Content-Typeがapplication/json以外なら415（OpenAIを呼ばない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await analyzePOST(
      postRequest(ANALYZE_URL, "brief=hello", { "content-type": "text/plain", "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("不正なJSONなら400（OpenAIを呼ばない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await analyzePOST(
      postRequest(ANALYZE_URL, "{not valid json", { "content-type": "application/json", "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("巨大なbodyなら413（OpenAIを呼ばない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hugeBrief = { brief: { storeName: "a", siteConcept: "x".repeat(30_000) } };
    const res = await analyzePOST(postJson(ANALYZE_URL, hugeBrief, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("未知フィールドは400で拒否する（OpenAIを呼ばない）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await analyzePOST(postJson(ANALYZE_URL, { unexpectedField: "x" }, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("photoUrlは未知フィールドとして400で拒否される（写真URL入力は無効化）", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await analyzePOST(
      postJson(ANALYZE_URL, { photoUrl: "https://evil.example.com/x.jpg" }, { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("brief内の文字列上限を超えたら400", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await analyzePOST(
      postJson(ANALYZE_URL, { brief: { storeName: "a".repeat(200) } }, { "x-diagnostic-token": TEST_TOKEN })
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("空bodyは安全な固定ダミーbriefへ変換され、正常に処理される", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlan) }) })
    );
    const res = await analyzePOST(postRequest(ANALYZE_URL, "", { "content-type": "application/json", "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.schemaValid).toBe(true);
  });
});

// ============================================================
// POST /analyze: BrandPlan取得（mock fetch）
// ============================================================
describe("POST /api/admin/brand-director/analyze: BrandPlan取得", () => {
  beforeEach(() => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    stubOpenAiEnv();
  });

  it("正常応答: BrandPlanを取得し、photoUrlはラベルへ置き換えて返す。OpenAI呼び出しは1回のみ", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlan), usage: { input_tokens: 10, output_tokens: 5 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("openai");
    expect(json.schemaValid).toBe(true);
    expect(json.fallbackReason).toBeNull();
    expect(json.plan.photoAssignments[0].photoUrl).toBe("photo#1");
    const bodyText = JSON.stringify(json);
    expect(bodyText).not.toContain("secret-photo.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refusalの場合はrule-providerへフォールバックする（呼び出しは初回+再試行1回まで）", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output: [{ type: "message", content: [{ type: "refusal", refusal: "cannot comply" }] }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    const json = await res.json();
    expect(json.fallbackReason).toContain("refus");
    expect(json.schemaValid).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
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
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    const json = await res.json();
    expect(json.fallbackReason).toContain("incomplete");
    expect(json.schemaValid).toBe(true);
  });

  it("Schema不一致の場合はrule-providerへフォールバックする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify({ nonsense: true }) }) })
    );
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    const json = await res.json();
    expect(json.fallbackReason).toContain("schema");
    expect(json.schemaValid).toBe(true);
  });

  it("HTTP 429の場合もrule-providerへ安全にフォールバックする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" }));
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fallbackReason).toContain("429");
  });

  it("HTTP 500の場合もrule-providerへ安全にフォールバックする（例外を漏らさない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }));
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("openai");
    expect(json.fallbackReason).toContain("500");
    expect(json.schemaValid).toBe(true);
  });

  it("タイムアウト時も安全にrule-providerへフォールバックする", async () => {
    process.env.OPENAI_TIMEOUT_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      })
    );
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.fallbackReason).not.toBeNull();
  }, 10000);

  it("応答フィールドは許可された最小集合のみで、内部情報は含まない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlan) }) })
    );
    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    const json = await res.json();
    expect(new Set(Object.keys(json))).toEqual(
      new Set(["requestId", "method", "provider", "model", "plan", "durationMs", "inputTokens", "outputTokens", "fallbackReason", "schemaValid"])
    );
  });

  it("APIキー・診断トークン・Authorizationヘッダー・内部プロンプトはレスポンスに含まれない", async () => {
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlan) }) })
    );

    const res = await analyzePOST(postJson(ANALYZE_URL, {}, { "x-diagnostic-token": TEST_TOKEN }));
    const bodyText = JSON.stringify(await res.json());
    expect(bodyText).not.toContain("sk-test-SECRET-VALUE");
    expect(bodyText).not.toContain(TEST_TOKEN);
    expect(bodyText).not.toContain("Bearer");
    expect(bodyText).not.toContain("Brand Director です"); // system prompt本文の断片
  });
});

// ============================================================
// レート制限（ベストエフォート）
// ============================================================
describe("レート制限: 同一診断トークンからの短時間連打", () => {
  it("同一トークンで6回目のリクエストは429になる", async () => {
    process.env.BRAND_DIRECTOR_DIAGNOSTIC_TOKEN = TEST_TOKEN;
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await modelsGET(getRequest(MODELS_URL, { "x-diagnostic-token": TEST_TOKEN }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});
