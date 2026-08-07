import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoreBrief } from "@/lib/types";
import type { BrandPlan } from "@/lib/brand-director/types";
import { BrandPlanSchema } from "@/lib/brand-director/schema";
import { ruleBrandDirectionProvider } from "@/lib/brand-director/rule-provider";
import { derivePhotoPlanFromBrandPlan, resolveBrandPlanForV2 } from "@/lib/brand-director/v2-connector";
import { generateWebsiteRuleBased } from "@/lib/engine/rule-based";
import { WebsiteRendererV2 } from "@/components/website-v2/WebsiteRendererV2";

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

const validBrandPlan = {
  brandArchetype: "artisan",
  industry: "cafe",
  audiences: ["地元客・観光客"],
  customerIntent: "新規客の獲得が伸び悩んでいる",
  moodKeywords: ["落ち着いた・上質", "自家焙煎の香りと落ち着いた店内体験", "本日の一杯 500円〜"],
  valueProposition: "自家焙煎の香りと落ち着いた店内体験",
  visualDirection: { paletteHint: "warm", typographyTone: "clean-sans", photoTreatment: "framed" },
  copyDirection: { tone: "落ち着いた・上質", emphasis: "atmosphere" },
  layoutVariant: "immersive",
  photoAssignments: [],
  ctaStrategy: { placement: "after-story", urgency: "high" },
  confidence: 0.7,
  evidence: [{ field: "moodKeywords", basis: "brief", detail: "brief.toneより" }],
};

const ENV_KEYS = [
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

describe("resolveBrandPlanForV2", () => {
  it("カフェ以外の業種ではBrand Directorを呼ばず、undefinedを返す", async () => {
    const spy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");
    const plan = await resolveBrandPlanForV2(salonBrief, "req-1");
    expect(plan).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("rule provider（既定・OPENAI_API_KEY未設定）でもBrandPlanを取得できる", async () => {
    const plan = await resolveBrandPlanForV2(cafeBrief, "req-2");
    expect(plan).toBeDefined();
    expect(BrandPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("生成時に実写真を最大3枚だけ分析し、その結果をBrandPlan決定へ渡す", async () => {
    const photoUrls = ["https://example.com/1.jpg", "https://example.com/2.jpg", "https://example.com/3.jpg", "https://example.com/4.jpg"];
    const analyses = photoUrls.slice(0, 3).map((photoUrl, index) => ({
      photoUrl,
      subject: index === 0 ? "coffee cup" : "cafe interior",
      brightness: "balanced" as const,
      orientation: "landscape" as const,
      dominantMood: "warm",
      containsPeople: false,
      containsFoodOrProduct: index === 0,
      containsExterior: false,
      containsInterior: true,
      textSafeArea: "left" as const,
      recommendedRole: index === 0 ? "hero" as const : "gallery" as const,
      qualityScore: 80,
      rejectionReason: null,
    }));
    const photosSpy = vi.spyOn(ruleBrandDirectionProvider, "analyzePhotos").mockResolvedValue(analyses);
    const brandSpy = vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand");

    await resolveBrandPlanForV2({ ...cafeBrief, realData: { photoUrls } }, "req-photo-analysis");

    expect(photosSpy).toHaveBeenCalledWith(photoUrls.slice(0, 3), expect.objectContaining({ requestId: "req-photo-analysis" }));
    expect(brandSpy).toHaveBeenCalledWith(expect.objectContaining({ requestId: "req-photo-analysis" }), analyses);
  });

  it("既定経路（OPENAI_API_KEY未設定）でv2ページを最後まで組み立てても壊れない。" +
    "archetype-heuristics.tsによりarchetype/paletteHintはbrief内容から決定論的に決まる" +
    "（cafeBriefのtone/siteConceptは決定論的にwellness-calm(→japanese-editorial)/" +
    "neutralへ解決される。以前のように業種だけでartisan/warmへ固定されるわけではない）", async () => {
    const contents = generateWebsiteRuleBased(cafeBrief);
    const brandPlan = await resolveBrandPlanForV2(cafeBrief, "req-2b");
    const html = renderToStaticMarkup(<WebsiteRendererV2 brief={cafeBrief} contents={contents} brandPlan={brandPlan} />);
    // japanese-editorial方向はarchetypeに関わらず常にeditorial-serifを使うため、
    // このbriefがどのarchetypeに解決されても書体自体は変わらない。
    expect(html).toContain("font-serif");
    // Hero見出し内のstoreName部分だけは、ブランド名として独立させるため
    // 常にfont-sansの小さめスパンで囲む（他は引き続きfont-serif）。
    expect(html).toContain("font-sans");
    // このbriefのtone("落ち着いた・上質")はneutralパレットのキーワードと一致するため、
    // paletteHint="neutral"に決定論的に解決される(アクセント色はtext-neutral-900)。
    expect(html).toContain("text-neutral-900");
  });

  it("OpenAI成功時、providerが返したBrandPlanがそのまま返る", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ output_text: JSON.stringify(validBrandPlan) }),
      })
    );

    const plan = await resolveBrandPlanForV2(cafeBrief, "req-3");
    expect(plan?.layoutVariant).toBe("immersive");
    expect(plan?.ctaStrategy.placement).toBe("after-story");
    expect(BrandPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("OpenAI失敗時も例外を投げず、schema通りのBrandPlan（rule由来）へ安全にフォールバックする", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "server error" }));

    const plan = await resolveBrandPlanForV2(cafeBrief, "req-4");
    expect(plan).toBeDefined();
    expect(BrandPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("スキーマ不正なOpenAI応答でも安全にフォールバックする", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-dummy";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ output_text: JSON.stringify({ nonsense: true }) }) })
    );

    const plan = await resolveBrandPlanForV2(cafeBrief, "req-5");
    expect(plan).toBeDefined();
    expect(BrandPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("provider呼び出し自体が例外を投げても、接続層はundefinedへ安全にフォールバックする（v2ページを落とさない）", async () => {
    vi.spyOn(ruleBrandDirectionProvider, "analyzeBrand").mockRejectedValue(new Error("unexpected failure"));
    const plan = await resolveBrandPlanForV2(cafeBrief, "req-6");
    expect(plan).toBeUndefined();
  });

  it("APIキー・写真URLの生値をログへ出さない", async () => {
    process.env.BRAND_DIRECTOR_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-SECRET-VALUE";
    process.env.OPENAI_MODEL_PREMIUM = "test-premium-model";
    const secretPhotoUrl = "https://example.com/secret-photo-xyz.jpg";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" }));

    await resolveBrandPlanForV2({ ...cafeBrief, realData: { photoUrls: [secretPhotoUrl] } }, "req-7");

    const allLogged = [...warnSpy.mock.calls, ...infoSpy.mock.calls].flat().map((v) => JSON.stringify(v)).join(" ");
    expect(allLogged).not.toContain("sk-test-SECRET-VALUE");
    expect(allLogged).not.toContain(secretPhotoUrl);
  });
});

describe("derivePhotoPlanFromBrandPlan", () => {
  const realPhotoUrls = ["https://example.com/a.jpg", "https://example.com/b.jpg", "https://example.com/c.jpg"];

  function makePlan(overrides: Partial<BrandPlan["photoAssignments"][number]>[]): BrandPlan["photoAssignments"] {
    return overrides.map((o) => ({
      photoUrl: realPhotoUrls[0],
      role: "gallery",
      qualityScore: 50,
      rejectionReason: null,
      ...o,
    }));
  }

  it("photoAssignmentsが空ならundefinedを返す（位置ベースへフォールバックさせる）", () => {
    const plan = { ...validBrandPlan, photoAssignments: [] } as unknown as BrandPlan;
    expect(derivePhotoPlanFromBrandPlan(plan, realPhotoUrls)).toBeUndefined();
  });

  it("全てreject roleならundefinedを返す", () => {
    const plan = {
      ...validBrandPlan,
      photoAssignments: makePlan([{ photoUrl: realPhotoUrls[0], role: "reject", rejectionReason: "blurry" }]),
    } as unknown as BrandPlan;
    expect(derivePhotoPlanFromBrandPlan(plan, realPhotoUrls)).toBeUndefined();
  });

  it("実データに無いURLが1件でも混ざっていればundefinedを返す（実データ優先・捏造防止）", () => {
    const plan = {
      ...validBrandPlan,
      photoAssignments: makePlan([
        { photoUrl: realPhotoUrls[0], role: "hero" },
        { photoUrl: "https://example.com/does-not-exist.jpg", role: "story" },
      ]),
    } as unknown as BrandPlan;
    expect(derivePhotoPlanFromBrandPlan(plan, realPhotoUrls)).toBeUndefined();
  });

  it("役割（role）に基づいてhero/story/galleryへ変換する（位置ではなく役割で決まる）", () => {
    // 3枚目をhero、1枚目をstoryに割り当てる（純粋な位置ベースなら1枚目がheroになるはずの逆パターン）。
    const plan = {
      ...validBrandPlan,
      photoAssignments: makePlan([
        { photoUrl: realPhotoUrls[2], role: "hero" },
        { photoUrl: realPhotoUrls[0], role: "story" },
        { photoUrl: realPhotoUrls[1], role: "gallery" },
      ]),
    } as unknown as BrandPlan;
    const result = derivePhotoPlanFromBrandPlan(plan, realPhotoUrls);
    expect(result?.heroPhotoUrl).toBe(realPhotoUrls[2]);
    expect(result?.storyPhotoUrl).toBe(realPhotoUrls[0]);
    expect(result?.galleryPhotoUrls).toEqual([realPhotoUrls[1]]);
    expect(result?.tier).toBe("moderate");
  });

  it("重複URLは1回だけ数える", () => {
    // 実データもこの1枚のみにして、「言及されていない実写真をGalleryへ残す」
    // 挙動と混同しないよう切り分ける。
    const onlyUrl = [realPhotoUrls[0]];
    const plan = {
      ...validBrandPlan,
      photoAssignments: makePlan([
        { photoUrl: onlyUrl[0], role: "hero" },
        { photoUrl: onlyUrl[0], role: "gallery" },
      ]),
    } as unknown as BrandPlan;
    const result = derivePhotoPlanFromBrandPlan(plan, onlyUrl);
    expect(result?.tier).toBe("minimal");
    expect(result?.galleryPhotoUrls).toEqual([]);
  });

  it("BrandPlanの上限(6枚)等でphotoAssignmentsに言及されていない実写真も、削除せずGalleryへ残す", () => {
    const manyRealUrls = [...realPhotoUrls, "https://example.com/d.jpg"]; // 実写真は4枚
    const plan = {
      ...validBrandPlan,
      // BrandPlanはa.jpg(hero)とb.jpg(story)しか言及していない（c.jpg/d.jpgは未言及）。
      photoAssignments: makePlan([
        { photoUrl: realPhotoUrls[0], role: "hero" },
        { photoUrl: realPhotoUrls[1], role: "story" },
      ]),
    } as unknown as BrandPlan;
    const result = derivePhotoPlanFromBrandPlan(plan, manyRealUrls);
    expect(result?.heroPhotoUrl).toBe(realPhotoUrls[0]);
    expect(result?.storyPhotoUrl).toBe(realPhotoUrls[1]);
    expect(result?.galleryPhotoUrls).toEqual(expect.arrayContaining([realPhotoUrls[2], "https://example.com/d.jpg"]));
    expect(result?.galleryPhotoUrls).toHaveLength(2);
    // 合計4枚(hero+story+gallery2枚)は"moderate"(3〜5)であり、"many"(6枚以上)ではない。
    expect(result?.tier).toBe("moderate");
  });

  it("rejectのみ除外し、それ以外のroleはgalleryとして扱う", () => {
    const plan = {
      ...validBrandPlan,
      photoAssignments: makePlan([
        { photoUrl: realPhotoUrls[0], role: "hero" },
        { photoUrl: realPhotoUrls[1], role: "menu" },
        { photoUrl: realPhotoUrls[2], role: "reject", rejectionReason: "blurry" },
      ]),
    } as unknown as BrandPlan;
    const result = derivePhotoPlanFromBrandPlan(plan, realPhotoUrls);
    expect(result?.heroPhotoUrl).toBe(realPhotoUrls[0]);
    expect(result?.galleryPhotoUrls).toEqual([realPhotoUrls[1]]);
  });
});
