/**
 * 編集パイプラインの最小ドメイン型`Artifact`と、生データからの抽出処理。
 *
 * 設計方針(neumos-ai/docs/design/editorial-pipeline-design.md 4章):
 *  - `Observation`という新しいデータ型は作らない。既存の`StoreBrief` +
 *    `GeneratedWebsiteContents`をそのまま生データとして扱う。
 *  - `toArtifacts()`は「これはEditorialでこれはUtility」を判断しない。
 *    抽出できる画像・テキストの候補を並列に列挙するだけで、分類は
 *    `filter.ts`の責務にする。
 *  - `absorbedCount`はCompress(compress.ts)がクラスタサイズ-1を書き込む、
 *    デバッグ・トレース専用フィールド。Presentation(presentation.ts)の
 *    判定入力としては使わない(「撮影枚数の多さ」と「情報としての重要度」を
 *    混同しないため)。
 */
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import { splitBulletLines } from "@/components/website/utils";

export type ArtifactMedia = "image" | "text";

interface BaseArtifact {
  /** 安定id。例: "photo:3" "text:concept" "text:menu:1" "text:review:0" */
  id: string;
  media: ArtifactMedia;
  /** Observation内での出現順。並び替えの根拠には使わない。Arrangeの決定的tie-breakにのみ使う。 */
  sourceOrder: number;
}

export interface ImageArtifact extends BaseArtifact {
  media: "image";
  url: string;
  /** Compressのデコード処理(dHash計算)の副産物として得られる。抽出時点では未設定。 */
  width?: number;
  height?: number;
  /** Compress前は常に0。デバッグ・reasons[]トレース専用(Presentationの判定入力にしない)。 */
  absorbedCount: number;
  /** AI生成の雰囲気画像(supplementalImages由来)は開示文言をRenderで必ず保持する。 */
  requiresDisclosure?: string;
}

export interface TextArtifact extends BaseArtifact {
  media: "text";
  text: string;
  charCount: number;
  /** 画像と同様、デバッグ専用。Presentationの判定入力には使わない。 */
  absorbedCount: number;
}

export type Artifact = ImageArtifact | TextArtifact;

export function isImageArtifact(a: Artifact): a is ImageArtifact {
  return a.media === "image";
}

export function isTextArtifact(a: Artifact): a is TextArtifact {
  return a.media === "text";
}

const MIN_MENU_DESCRIPTION_CHARS = 40;

function makeText(id: string, sourceOrder: number, text: string): TextArtifact | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return { id, media: "text", sourceOrder, text: trimmed, charCount: trimmed.length, absorbedCount: 0 };
}

function makeImage(id: string, sourceOrder: number, url: string, requiresDisclosure?: string): ImageArtifact | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  return { id, media: "image", sourceOrder, url: trimmed, absorbedCount: 0, requiresDisclosure };
}

/**
 * 生データ(`StoreBrief` + `GeneratedWebsiteContents`)から、Editorial候補となる
 * 画像・テキストArtifactを並列に抽出する。Editorial/Utilityの分類は行わない
 * (`filter.ts`の責務)。
 *
 * 抽出元(設計書4章と一致させる):
 *  - 画像: realData.photoUrls各件、realData.supplementalImages各件
 *  - テキスト: contents.concept、contents.sections(kind="about"|"feature"を
 *    splitBulletLinesで分割)、realData.menuItems[].description(40文字以上のみ)、
 *    realData.reviews[].text
 */
export function toArtifacts(brief: StoreBrief, contents: GeneratedWebsiteContents): Artifact[] {
  const artifacts: Artifact[] = [];
  let order = 0;

  const photoUrls = brief.realData?.photoUrls ?? [];
  for (const url of photoUrls) {
    const artifact = makeImage(`photo:${order}`, order, url);
    if (artifact) artifacts.push(artifact);
    order++;
  }

  const supplementalImages = brief.realData?.supplementalImages ?? [];
  for (const image of supplementalImages) {
    const artifact = makeImage(`supplemental:${order}`, order, image.url, image.disclosure);
    if (artifact) artifacts.push(artifact);
    order++;
  }

  const concept = makeText(`text:concept:${order}`, order, contents.concept ?? "");
  if (concept) artifacts.push(concept);
  order++;

  const narrativeSections = contents.sections.filter((s) => s.kind === "about" || s.kind === "feature");
  for (const section of narrativeSections) {
    const lines = splitBulletLines(section.body ?? "");
    for (const line of lines) {
      const artifact = makeText(`text:section:${order}`, order, line);
      if (artifact) artifacts.push(artifact);
      order++;
    }
  }

  const menuItems = brief.realData?.menuItems ?? [];
  for (const item of menuItems) {
    const description = item.description ?? "";
    if (description.trim().length >= MIN_MENU_DESCRIPTION_CHARS) {
      const artifact = makeText(`text:menu:${order}`, order, description);
      if (artifact) artifacts.push(artifact);
    }
    order++;
  }

  const reviews = brief.realData?.reviews ?? [];
  for (const review of reviews) {
    const artifact = makeText(`text:review:${order}`, order, review.text ?? "");
    if (artifact) artifacts.push(artifact);
    order++;
  }

  return artifacts;
}
