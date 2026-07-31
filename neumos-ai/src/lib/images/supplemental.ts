import { getSupabaseAdmin } from "@/lib/supabase/server";
import { classifyIndustry } from "@/lib/engine/industry";
import type { StoreBrief, SupplementalImage } from "@/lib/types";

const DISCLOSURE = "AI生成イメージ（実際の店舗写真ではありません）" as const;
const DEFAULT_BUCKET = "neumos-generated-assets";

interface Dependencies {
  generateImage?: (prompt: string) => Promise<Uint8Array>;
  uploadImage?: (path: string, bytes: Uint8Array) => Promise<string>;
}

function buildPrompt(brief: StoreBrief): string {
  return `Premium editorial atmosphere photograph for a Japanese cafe website. Mood: ${brief.tone}. Concept: ${brief.siteConcept}. Generic still life using natural light, steam, linen, wood, ceramics or shadows. Decorative mood image only, not the actual store. No recognizable storefront, actual interior, menu item, people, logo, sign, address, map or readable text. Landscape, realistic texture.`;
}

async function generateWithOpenAI(prompt: string): Promise<Uint8Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", prompt, size: "1536x1024", quality: process.env.OPENAI_IMAGE_QUALITY || "low", n: 1 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`OpenAI image generation failed (${response.status})`);
  const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const encoded = payload.data?.[0]?.b64_json;
  if (!encoded) throw new Error("OpenAI image response did not contain image data");
  return Buffer.from(encoded, "base64");
}

async function uploadToSupabase(path: string, bytes: Uint8Array): Promise<string> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase Storage is not configured");
  const storage = admin.storage.from(process.env.SUPPLEMENTAL_IMAGE_STORAGE_BUCKET || DEFAULT_BUCKET);
  const { error } = await storage.upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) throw new Error(`Supplemental image upload failed (${error.message})`);
  return storage.getPublicUrl(path).data.publicUrl;
}

export async function resolveSupplementalImages(brief: StoreBrief, requestId: string, dependencies: Dependencies = {}): Promise<SupplementalImage[]> {
  if (process.env.SUPPLEMENTAL_IMAGE_PROVIDER !== "openai") return [];
  if (classifyIndustry(brief.industry) !== "cafe") return [];
  if ((brief.realData?.photoUrls?.length ?? 0) >= 2) return [];
  try {
    const bytes = await (dependencies.generateImage ?? generateWithOpenAI)(buildPrompt(brief));
    const path = `supplemental/${requestId}/atmosphere.png`;
    const url = await (dependencies.uploadImage ?? uploadToSupabase)(path, bytes);
    return [{ url, source: "openai-generated", role: "atmosphere", altText: `${brief.storeName}の世界観を表現したAI生成イメージ`, disclosure: DISCLOSURE, promptVersion: "cafe-atmosphere-v1" }];
  } catch (error) {
    console.warn("[neumos-ai] supplemental image skipped", { requestId, reason: error instanceof Error ? error.message : "unknown error" });
    return [];
  }
}
