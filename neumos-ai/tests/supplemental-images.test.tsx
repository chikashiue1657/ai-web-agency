import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StoreBrief } from "@/lib/types";
import { buildSupplementalImagePrompt, resolveSupplementalImages } from "@/lib/images/supplemental";
import { SupplementalImageV2 } from "@/components/website-v2/SupplementalImageV2";
import type { BrandPlan } from "@/lib/brand-director/types";

const brief: StoreBrief = {
  storeName: "Test Cafe", industry: "cafe", area: "Tokyo", targetCustomer: "adults",
  mainProblem: "awareness", salesAngle: "quiet coffee time", websiteGoal: "visits",
  siteConcept: "calm craft cafe", recommendedPages: ["top"], seoKeywords: ["cafe"],
  tone: "warm and quiet", offer: "coffee",
};

const brandPlan = {
  supplementalImageDirection: {
    sourcePhotoUrl: "https://example.com/store.jpg",
    storeStrength: "counter craft and a broad bean selection",
    visitMotivation: "discover beans and talk with a barista",
    commercialSubject: "bean-selection",
    shotType: "merchandise-detail",
    cameraAngle: "counter-height",
    composition: "layered-depth",
    lighting: "warm-ambient",
    sensoryCues: ["warm wood", "handmade service"],
    truthBoundary: ["do not recreate the store"],
    avoid: ["perfect kraft bags", "scattered beans"],
  },
} as BrandPlan;

beforeEach(() => { delete process.env.SUPPLEMENTAL_IMAGE_PROVIDER; });
afterEach(() => { vi.restoreAllMocks(); });

describe("AI supplemental images", () => {
  it("is disabled by default", async () => {
    const generateImage = vi.fn();
    expect(await resolveSupplementalImages(brief, "req-1", { generateImage })).toEqual([]);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("skips generation when two real photos already exist", async () => {
    process.env.SUPPLEMENTAL_IMAGE_PROVIDER = "openai";
    const generateImage = vi.fn();
    const withPhotos = { ...brief, realData: { photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"] } };
    expect(await resolveSupplementalImages(withPhotos, "req-2", { generateImage })).toEqual([]);
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("generates and stores at most one disclosed atmosphere image", async () => {
    process.env.SUPPLEMENTAL_IMAGE_PROVIDER = "openai";
    const generateImage = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const uploadImage = vi.fn().mockResolvedValue("https://example.supabase.co/storage/v1/object/public/assets/a.png");
    const result = await resolveSupplementalImages(brief, "req-3", { generateImage, uploadImage });
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("atmosphere");
    expect(result[0].disclosure).toContain("実際の店舗写真ではありません");
    expect(uploadImage).toHaveBeenCalledWith("supplemental/req-3/atmosphere.png", expect.any(Uint8Array));
  });

  it("uses the Brand Director shooting brief instead of a generic mood-only prompt", () => {
    const prompt = buildSupplementalImagePrompt(brief, brandPlan);
    expect(prompt).toContain("counter craft and a broad bean selection");
    expect(prompt).toContain("merchandise-detail");
    expect(prompt).toContain("counter-height");
    expect(prompt).toContain("perfect kraft bags");
    expect(prompt).toContain("Do not recreate the actual store");
  });

  it("stores per-generation token usage and an output-cost estimate when provided", async () => {
    process.env.SUPPLEMENTAL_IMAGE_PROVIDER = "openai";
    vi.spyOn(console, "info").mockImplementation(() => {});
    const usage = {
      model: "gpt-image-2", quality: "low", size: "1536x1024",
      inputTokens: 20, outputTokens: 196, totalTokens: 216,
      estimatedOutputCostUsd: 0.005, remainingProjectCreditUsd: null,
    } as const;
    const result = await resolveSupplementalImages(brief, "req-usage", brandPlan, {
      generateImage: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), usage }),
      uploadImage: vi.fn().mockResolvedValue("https://example.com/generated.png"),
    });
    expect(result[0].usage).toEqual(usage);
    expect(result[0].promptVersion).toBe("cafe-shot-plan-v2");
  });

  it("fails open when generation fails", async () => {
    process.env.SUPPLEMENTAL_IMAGE_PROVIDER = "openai";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await resolveSupplementalImages(brief, "req-4", { generateImage: vi.fn().mockRejectedValue(new Error("failed")) });
    expect(result).toEqual([]);
  });

  it("renders an explicit AI disclosure", () => {
    const html = renderToStaticMarkup(<SupplementalImageV2 image={{
      url: "https://example.com/ai.png", source: "openai-generated", role: "atmosphere",
      altText: "AI atmosphere", disclosure: "AI生成イメージ（実際の店舗写真ではありません）",
      promptVersion: "cafe-atmosphere-v1",
    }} />);
    expect(html).toContain("AI生成イメージ（実際の店舗写真ではありません）");
    expect(html).toContain("supplemental-image");
  });
});
