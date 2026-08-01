import { getSupabaseAdmin } from "@/lib/supabase/server";
import { classifyIndustry } from "@/lib/engine/industry";
import type { BrandPlan, SupplementalImageDirection } from "@/lib/brand-director/types";
import type { StoreBrief, SupplementalImage, SupplementalImageUsage } from "@/lib/types";

const DISCLOSURE = "AI生成イメージ（実際の店舗写真ではありません）" as const;
const DEFAULT_BUCKET = "neumos-generated-assets";
const DEFAULT_MODEL = "gpt-image-2";
const DEFAULT_QUALITY = "low";
const DEFAULT_SIZE = "1536x1024";

interface GeneratedImageResult {
  bytes: Uint8Array;
  usage?: SupplementalImageUsage;
}

interface Dependencies {
  generateImage?: (prompt: string) => Promise<Uint8Array | GeneratedImageResult>;
  uploadImage?: (path: string, bytes: Uint8Array) => Promise<string>;
}

function fallbackDirection(brief: StoreBrief): SupplementalImageDirection {
  return {
    sourcePhotoUrl: null,
    storeStrength: brief.salesAngle,
    visitMotivation: brief.websiteGoal,
    commercialSubject: "coffee-craft",
    shotType: "ritual-detail",
    cameraAngle: "counter-height",
    composition: "asymmetric-editorial",
    lighting: "soft-window",
    sensoryCues: [brief.tone, brief.siteConcept].filter(Boolean).slice(0, 4),
    truthBoundary: ["実在店舗の再現ではない", "ロゴ・商品名・内外装を作らない"],
    avoid: ["架空の店舗外観", "読める文字", "過剰に整った商品陳列", "広告的な豆の散乱"],
  };
}

export function buildSupplementalImagePrompt(brief: StoreBrief, brandPlan?: BrandPlan): string {
  const direction = brandPlan?.supplementalImageDirection ?? fallbackDirection(brief);
  return [
    "Create one premium editorial commercial photograph for a Japanese cafe website.",
    `Business goal: ${direction.visitMotivation}.`,
    `Store strength to communicate: ${direction.storeStrength}.`,
    `Commercial subject: ${direction.commercialSubject}; shot type: ${direction.shotType}.`,
    `Camera: ${direction.cameraAngle}; composition: ${direction.composition}; lighting: ${direction.lighting}.`,
    `Sensory cues: ${direction.sensoryCues.join(", ")}.`,
    "The image must immediately read as a real coffee-shop experience and give a concrete reason to visit.",
    "Use believable, naturally imperfect materials and restrained editorial styling. Landscape photograph, realistic texture.",
    `Truth boundaries: ${direction.truthBoundary.join("; ")}.`,
    `Avoid: ${direction.avoid.join("; ")}.`,
    "Do not recreate the actual store. Do not invent a storefront, interior architecture, branded packaging, menu item, logo, sign, address, map, people, or readable text.",
  ].join(" ");
}

function estimateOutputCostUsd(model: string, quality: string, size: string): number | null {
  if (model !== "gpt-image-2") return null;
  const table: Record<string, Record<string, number>> = {
    low: { "1024x1024": 0.006, "1024x1536": 0.005, "1536x1024": 0.005 },
    medium: { "1024x1024": 0.053, "1024x1536": 0.041, "1536x1024": 0.041 },
    high: { "1024x1024": 0.211, "1024x1536": 0.165, "1536x1024": 0.165 },
  };
  return table[quality]?.[size] ?? null;
}

async function generateWithOpenAI(prompt: string): Promise<GeneratedImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const model = process.env.OPENAI_IMAGE_MODEL || DEFAULT_MODEL;
  const quality = process.env.OPENAI_IMAGE_QUALITY || DEFAULT_QUALITY;
  const size = DEFAULT_SIZE;
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status})`);
  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI image response did not contain image data");
  return {
    bytes: Buffer.from(encoded, "base64"),
    usage: {
      model,
      quality,
      size,
      inputTokens: payload.usage?.input_tokens ?? null,
      outputTokens: payload.usage?.output_tokens ?? null,
      totalTokens: payload.usage?.total_tokens ?? null,
      estimatedOutputCostUsd: estimateOutputCostUsd(model, quality, size),
      remainingProjectCreditUsd: null,
    },
  };
}

async function uploadToSupabase(path: string, bytes: Uint8Array): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase Storage is not configured");
  const storage = admin.storage.from(process.env.SUPPLEMENTAL_IMAGE_STORAGE_BUCKET || DEFAULT_BUCKET);
  const { error } = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Supplemental image upload failed (${error.message})`);
  return storage.getPublicUrl(path).data.publicUrl;
}

function normalizeGeneratedImage(result: Uint8Array | GeneratedImageResult): GeneratedImageResult {
  return result instanceof Uint8Array ? { bytes: result } : result;
}

export async function resolveSupplementalImages(
  brief: StoreBrief,
  requestId: string,
  brandPlanOrDependencies?: BrandPlan | Dependencies,
  dependencies: Dependencies = {}
): Promise<SupplementalImage[]> {
  const isDependencies = !!brandPlanOrDependencies &&
    ("generateImage" in brandPlanOrDependencies || "uploadImage" in brandPlanOrDependencies);
  const brandPlan = isDependencies ? undefined : brandPlanOrDependencies as BrandPlan | undefined;
  const resolvedDependencies = isDependencies ? brandPlanOrDependencies as Dependencies : dependencies;
  if (process.env.SUPPLEMENTAL_IMAGE_PROVIDER !== "openai") return [];
  if (classifyIndustry(brief.industry) !== "cafe") return [];
  if ((brief.realData?.photoUrls?.length ?? 0) >= 2) return [];
  try {
    const generated = normalizeGeneratedImage(
      await (resolvedDependencies.generateImage ?? generateWithOpenAI)(buildSupplementalImagePrompt(brief, brandPlan))
    );
    const path = `supplemental/${requestId}/atmosphere.png`;
    const url = await (resolvedDependencies.uploadImage ?? uploadToSupabase)(path, generated.bytes);
    if (generated.usage) {
      console.info("[neumos-ai] supplemental image usage", { requestId, ...generated.usage });
    }
    return [{
      url,
      source: "openai-generated",
      role: "atmosphere",
      altText: `${brief.storeName}の世界観を表現したAI生成イメージ`,
      disclosure: DISCLOSURE,
      promptVersion: "cafe-shot-plan-v2",
      usage: generated.usage,
    }];
  } catch (error) {
    console.warn("[neumos-ai] supplemental image skipped", {
      requestId,
      reason: error instanceof Error ? error.message : "unknown error",
    });
    return [];
  }
}
