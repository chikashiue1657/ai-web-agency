import { randomUUID } from "node:crypto";
import { runGeneration } from "@/lib/engine";
import { renderWebsitePreviewHtml } from "@/lib/preview/render";
import { saveGenerationRecord } from "@/lib/store";
import { resolveBrandPlanForV2 } from "@/lib/brand-director/v2-connector";
import { classifyIndustry } from "@/lib/engine/industry";
import type { GenerationType, StoreBrief, StoredGenerationRecord } from "@/lib/types";
import { resolveSupplementalImages } from "@/lib/images/supplemental";

/** `/api/generate` と MVP互換の `/api/v1/contents` から共有される生成本体。 */
export async function performGeneration(
  generationType: GenerationType,
  brief: StoreBrief,
  origin: string
): Promise<StoredGenerationRecord> {
  const { contents, method } = await runGeneration(generationType, brief);

  const requestId = randomUUID();
  const previewHtml = renderWebsitePreviewHtml(brief, contents);
  // カフェは販売品質のv2を既定プレビューにする。従来のv1 URL自体は残すため、
  // 既存レコードや比較確認の後方互換性は維持される。
  const previewUrl = `${origin}/preview/${requestId}${classifyIndustry(brief.industry) === "cafe" ? "/v2" : ""}`;

  // v2デザインエンジン（カフェ業態専用）が使うBrandPlanは、ここ（生成処理中）で
  // 一度だけ作成しrecordへ保存する。v2プレビューを開く・更新するたびにOpenAIを
  // 再実行しないようにするため（レンダリング時には絶対に呼ばない）。
  // resolveBrandPlanForV2はカフェ以外なら即undefined、失敗時も例外を投げず
  // undefinedを返す設計のため、ここで失敗してもrecordの保存自体は継続する。
  const brandPlan = await resolveBrandPlanForV2(brief, requestId);
  // 実写真の分析を含むBrandPlanの撮影指示を、不足写真の生成へ渡す。
  // ここで一度だけ生成し、v2表示時にはOpenAIを呼ばない。
  const supplementalImages = await resolveSupplementalImages(brief, requestId, brandPlan);
  const resolvedBrief: StoreBrief = supplementalImages.length
    ? { ...brief, realData: { ...brief.realData, supplementalImages } }
    : brief;

  const record: StoredGenerationRecord = {
    requestId,
    generationType,
    brief: resolvedBrief,
    status: "preview",
    method,
    generatedContents: contents,
    previewHtml,
    previewUrl,
    publishedUrl: null,
    createdAt: new Date().toISOString(),
    brandPlan,
  };
  await saveGenerationRecord(record);
  return record;
}
