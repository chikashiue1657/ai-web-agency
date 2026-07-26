import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoreBrief } from "@/lib/types";
import { performGeneration } from "@/lib/generate";
import { saveGenerationRecord } from "@/lib/store";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { ruleBrandDirectionProvider } from "@/lib/brand-director/rule-provider";
import { BrandPlanSchema } from "@/lib/brand-director/schema";
import PreviewV2Page from "@/app/preview/[requestId]/v2/page";

/**
 * BrandPlanは「生成時（performGeneration）に一度だけ」作成・永続化され、
 * v2プレビューページ（/preview/[requestId]/v2）のレンダリング時には
 * 絶対にBrand Director（rule/openaiどちらのproviderも）を呼び出さないことを検証する。
 * このファイルではPreviewV2Pageを直接呼び出す（Next.jsのSSRを介さない、
 * 既存のgenerate-route.test.tsと同じ「モジュールを直接呼ぶ」流儀）。
 */
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

const salonBrief: StoreBrief = { ...cafeBrief, storeName: "美容室 結", industry: "美容室" };

const ENV_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "BRAND_DIRECTOR_PROVIDER",
  "OPENAI_MODEL_STANDARD",
  "OPENAI_MODEL_PREMIUM",
  "OPENAI_MODEL_VISION",
] as const;

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("performGeneration: BrandPlanは生成時に一度だけ作成される", () => {
  it("カフェの生成では、Brand Directorが1回だけ呼ばれBrandPlanがrecordへ保存される", async () => {
    const spy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");
    const record = await performGeneration("website", cafeBrief, "http://localhost:3100");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(record.brandPlan).toBeDefined();
    expect(BrandPlanSchema.safeParse(record.brandPlan).success).toBe(true);
  });

  it("カフェ以外の生成では、Brand Directorは呼ばれずbrandPlanはundefinedのまま", async () => {
    const spy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");
    const record = await performGeneration("website", salonBrief, "http://localhost:3100");

    expect(spy).not.toHaveBeenCalled();
    expect(record.brandPlan).toBeUndefined();
  });

  it("同じv2プレビューページを複数回表示しても、Brand Directorは追加で呼ばれない（生成時の1回のみ）", async () => {
    const spy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");
    const record = await performGeneration("website", cafeBrief, "http://localhost:3100");
    expect(spy).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 3; i++) {
      const element = await PreviewV2Page({ params: { requestId: record.requestId } });
      const html = renderToStaticMarkup(element);
      expect(html).toContain(cafeBrief.storeName);
    }

    // ページを何回開いても、呼び出し回数は生成時の1回のまま増えない。
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("OpenAI失敗時（接続不可等）でも、生成レコード自体は正常に保存される", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }));

    const record = await performGeneration("website", cafeBrief, "http://localhost:3100");

    expect(record.status).toBe("preview");
    // OpenAI失敗時もopenai-provider自体がrule-providerへ安全にフォールバックするため、
    // brandPlanはundefinedにはならず、schema通りの値が保存される。
    expect(record.brandPlan).toBeDefined();
    expect(BrandPlanSchema.safeParse(record.brandPlan).success).toBe(true);
  });

  it("APIキー・写真URLの生値をログへ出さない（生成時点でのBrand Director呼び出し）", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    const secretPhotoUrl = "https://example.com/secret-photo-abc.jpg";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" }));

    await performGeneration(
      "website",
      { ...cafeBrief, realData: { photoUrls: [secretPhotoUrl] } },
      "http://localhost:3100"
    );

    const allLogged = [...warnSpy.mock.calls, ...infoSpy.mock.calls].flat().map((v) => JSON.stringify(v)).join(" ");
    expect(allLogged).not.toContain("sk-test-SECRET-VALUE");
    expect(allLogged).not.toContain(secretPhotoUrl);
  });
});

describe("v2ページ: legacyレコード（brandPlanフィールド自体が無い）の表示", () => {
  it("brandPlanが無いレコードでもBrand Directorを呼ばずに、従来通りの見た目で正常表示できる", async () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const legacyRequestId = "legacy-req-no-brandplan";
    await saveGenerationRecord({
      requestId: legacyRequestId,
      generationType: "website",
      brief: cafeBrief,
      status: "preview",
      method: "rule",
      generatedContents: contents,
      previewHtml: "<html></html>",
      previewUrl: `http://localhost:3100/preview/${legacyRequestId}`,
      publishedUrl: null,
      createdAt: new Date().toISOString(),
      // brandPlanを意図的に付けない（列追加前に作成された旧レコードを模す）。
    });

    const spy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");
    const element = await PreviewV2Page({ params: { requestId: legacyRequestId } });
    const html = renderToStaticMarkup(element);

    expect(spy).not.toHaveBeenCalled();
    expect(html).toContain(cafeBrief.storeName);
    // BrandPlan無し＝既定テーマ（serif/amber）のまま。
    expect(html).toContain("font-serif");
  });
});
