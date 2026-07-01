import { randomUUID } from "node:crypto";
import { runGeneration } from "@/lib/engine";
import { renderWebsitePreviewHtml } from "@/lib/preview/render";
import { saveGenerationRecord } from "@/lib/store";
import type { GenerationType, StoreBrief, StoredGenerationRecord } from "@/lib/types";

/** `/api/generate` と MVP互換の `/api/v1/contents` から共有される生成本体。 */
export async function performGeneration(
  generationType: GenerationType,
  brief: StoreBrief,
  origin: string
): Promise<StoredGenerationRecord> {
  const { contents, method } = await runGeneration(generationType, brief);

  const requestId = randomUUID();
  const previewHtml = renderWebsitePreviewHtml(brief, contents);
  const previewUrl = `${origin}/preview/${requestId}`;

  const record: StoredGenerationRecord = {
    requestId,
    generationType,
    brief,
    status: "preview",
    method,
    generatedContents: contents,
    previewHtml,
    previewUrl,
    publishedUrl: null,
    createdAt: new Date().toISOString(),
  };
  saveGenerationRecord(record);
  return record;
}
