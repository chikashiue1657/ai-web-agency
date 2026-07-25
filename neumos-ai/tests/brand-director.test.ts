import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreBrief } from "@/lib/types";
import { BrandPlanSchema, PhotoAnalysisSchema } from "@/lib/brand-director/schema";
import { getBrandDirectionProvider, isBrandDirectorOpenAiConfigured } from "@/lib/brand-director/provider";
import { ruleBrandDirectionProvider } from "@/lib/brand-director/rule-provider";
import { openaiBrandDirectionProvider } from "@/lib/brand-director/openai-provider";

const cafeBrief: StoreBrief = {
  storeName: "BB-Coffee",
  industry: "カフェ",
  area: "沖縄市",
  targetCustomer: "地元客・観光客",
  mainProblem: "新規客の獲得が伸び悩んでいる",
  salesAngle: "自家焙煎の香りと落ち着いた店内体験",
  websiteGoal: "来店予約とInstagramフォローの増加",
  siteConcept: "焙煎の香りが伝わる、静かな時間を過ごせるカフェ",
  recommendedPages: ["トップ"],
  seoKeywords: ["沖縄市 カフェ"],
  tone: "落ち着いた・上質",
  offer: "本日の一杯 500円〜",
};

function makeInput(realData?: StoreBrief["realData"]) {
  return { requestId: "test-request-id", brief: { ...cafeBrief, realData } };
}

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.BRAND_DIRECTOR_PROVIDER;
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBrandDirectionProvider", () => {
  it("BRAND_DIRECTOR_PROVIDER未設定ならruleを返す", () => {
    expect(getBrandDirectionProvider().name).toBe("rule");
    expect(isBrandDirectorOpenAiConfigured()).toBe(false);
  });

  it("BRAND_DIRECTOR_PROVIDER=openaiでもOPENAI_API_KEYが無ければruleへフォールバックする", () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    expect(getBrandDirectionProvider().name).toBe("rule");
  });

  it("BRAND_DIRECTOR_PROVIDER=openai かつ OPENAI_API_KEY がある場合のみopenaiを返す", () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    expect(getBrandDirectionProvider().name).toBe("openai");
    expect(isBrandDirectorOpenAiConfigured()).toBe(true);
  });
});

describe("ruleBrandDirectionProvider（OPENAI_API_KEY無しの既定経路）", () => {
  it("ダミーのカフェbriefからSchema通りのBrandPlanを返す", async () => {
    const result = await ruleBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.usage.provider).toBe("rule");
    expect(result.usage.success).toBe(true);
  });

  it("写真0枚でも成功する（photoAssignmentsは空配列）", async () => {
    const result = await ruleBrandDirectionProvider.analyzeBrand(makeInput({ photoUrls: [] }));
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.plan.photoAssignments).toEqual([]);
  });

  it("写真1枚ならheroへ割当てる", async () => {
    const result = await ruleBrandDirectionProvider.analyzeBrand(
      makeInput({ photoUrls: ["https://example.com/a.jpg"] })
    );
    expect(result.plan.photoAssignments).toEqual([
      { photoUrl: "https://example.com/a.jpg", role: "hero", qualityScore: 0.5, rejectionReason: null },
    ]);
  });

  it("brief.realDataに無い事実を作らない（moodKeywordsはbrief由来の値のみ）", async () => {
    const result = await ruleBrandDirectionProvider.analyzeBrand(makeInput());
    for (const kw of result.plan.moodKeywords) {
      const inBrief = Object.values(cafeBrief).some((v) => typeof v === "string" && v.includes(kw));
      expect(inBrief || kw === "cafe").toBe(true);
    }
  });

  it("analyzePhotosはVision無しで中立値を返す（内容を断定しない）", async () => {
    const results = await ruleBrandDirectionProvider.analyzePhotos(["https://example.com/a.jpg"], makeInput());
    expect(results).toHaveLength(1);
    expect(results[0].subject).toBe("unknown");
    expect(PhotoAnalysisSchema.safeParse(results[0]).success).toBe(true);
  });
});

describe("openaiBrandDirectionProvider（mock fetch）", () => {
  const validBrandPlan = {
    brandArchetype: "artisan",
    industry: "cafe",
    audiences: ["地元客・観光客"],
    customerIntent: "新規客の獲得が伸び悩んでいる",
    moodKeywords: ["落ち着いた・上質", "自家焙煎の香りと落ち着いた店内体験", "本日の一杯 500円〜"],
    valueProposition: "自家焙煎の香りと落ち着いた店内体験",
    visualDirection: { paletteHint: "warm", typographyTone: "clean-sans", photoTreatment: "framed" },
    copyDirection: { tone: "落ち着いた・上質", emphasis: "atmosphere" },
    layoutVariant: "direct",
    photoAssignments: [],
    ctaStrategy: { placement: "hero", urgency: "medium" },
    confidence: 0.7,
    evidence: [{ field: "moodKeywords", basis: "brief", detail: "brief.toneより" }],
  };

  function mockFetchOnce(response: { ok: boolean; status?: number; body: unknown }) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        text: async () => JSON.stringify(response.body),
      })
    );
  }

  it("Schema通りのBrandPlanが返る", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    mockFetchOnce({ ok: true, body: { output_text: JSON.stringify(validBrandPlan), usage: { input_tokens: 100, output_tokens: 50 } } });

    const result = await openaiBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.usage.provider).toBe("openai");
    expect(result.usage.success).toBe(true);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  it("APIエラー時は既存生成を止めず、ruleへフォールバックする", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" })
    );

    const result = await openaiBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.usage.fallbackReason).not.toBeNull();
    expect(result.usage.success).toBe(true); // フォールバック後のrule結果自体はsuccess
  });

  it("スキーマ不一致のレスポンスでもruleへフォールバックする", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    // MAX_RETRIES分（1回の再試行）だけ余分に呼ばれるため、両方の呼び出し分をmockする。
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: JSON.stringify({ nonsense: true }) }),
      })
    );

    const result = await openaiBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.usage.fallbackReason).toContain("schema");
  });

  it("タイムアウト時に安全にruleへフォールバックする", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_TIMEOUT_MS = "50";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      })
    );

    const result = await openaiBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
    expect(result.usage.fallbackReason).not.toBeNull();
    delete process.env.OPENAI_TIMEOUT_MS;
  }, 10000);

  it("写真1枚の場合にVision分析が成功する", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    const validPhotoAnalysis = {
      photoUrl: "https://example.com/a.jpg",
      subject: "coffee cup on wooden table",
      brightness: "bright",
      orientation: "landscape",
      dominantMood: "warm",
      containsPeople: false,
      containsFoodOrProduct: true,
      containsExterior: false,
      containsInterior: true,
      textSafeArea: "top",
      recommendedRole: "hero",
      qualityScore: 0.8,
      rejectionReason: null,
    };
    mockFetchOnce({ ok: true, body: { output_text: JSON.stringify(validPhotoAnalysis) } });

    const results = await openaiBrandDirectionProvider.analyzePhotos(
      ["https://example.com/a.jpg"],
      makeInput({ photoUrls: ["https://example.com/a.jpg"] })
    );
    expect(results).toHaveLength(1);
    expect(PhotoAnalysisSchema.safeParse(results[0]).success).toBe(true);
    expect(results[0].recommendedRole).toBe("hero");
  });

  it("写真0枚の場合に成功する（空配列を返す、APIを呼ばない）", async () => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const results = await openaiBrandDirectionProvider.analyzePhotos([], makeInput());
    expect(results).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("APIキーやレスポンス全文をログへ漏らさない", async () => {
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "sk-test-SECRET-VALUE leaked in body" })
    );

    await openaiBrandDirectionProvider.analyzeBrand(makeInput());

    const allLoggedText = warnSpy.mock.calls.flat().map((v) => JSON.stringify(v)).join(" ");
    expect(allLoggedText).not.toContain("sk-test-SECRET-VALUE");
    warnSpy.mockRestore();
  });
});

describe("実API接続試験（明示的1件のみ・OPENAI_API_KEY未設定またはネットワーク到達不可ならskip）", () => {
  // このファイルのbeforeEachでOPENAI_API_KEYを削除しているため、実キーで実行したい場合は
  // `OPENAI_API_KEY=sk-... npx vitest run tests/brand-director.test.ts` のように
  // シェル側の環境変数として渡すこと（テストコード側では削除前の値を退避して使う）。
  const realKeyFromShell = process.env.OPENAI_API_KEY;

  it.skipIf(!realKeyFromShell)("実際のOpenAI Responses APIへ接続しBrandPlanを取得できる", async () => {
    vi.unstubAllGlobals(); // このテストだけは本物のfetchを使う
    process.env.OPENAI_API_KEY = realKeyFromShell;
    const result = await openaiBrandDirectionProvider.analyzeBrand(makeInput());
    expect(BrandPlanSchema.safeParse(result.plan).success).toBe(true);
  }, 20000);
});
