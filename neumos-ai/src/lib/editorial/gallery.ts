/**
 * Gallery(PhotoStoryV2)専用の写真編集エンジンの入口。
 *
 *   Store Data → photo-curation → filter → compress → arrange → presentation → PhotoStoryV2
 *
 * ページ全体の構成・Hero・CTA・Utility情報には一切関与しない。既存v2の
 * セクション構成(HeaderV2/HeroV2/StoryV2/SignatureV2/MenuV2/TrustV2/
 * AccessHoursV2/CTAV2/Footer)は変更せず、PhotoStoryV2へ渡す写真URL配列
 * だけを、知覚的重複排除(dHash)と類似度ベースの並び替えに通した上で、
 * Occupy判定された写真を先頭へ寄せて返す(PhotoStoryV2のtreatment="mixed"は
 * 先頭の写真を大きく見せる構成のため、Occupy写真が自然に主役になる)。
 *
 * React/UIに一切依存しない純粋なasync関数であり、Renderer(React/PDF/動画等)
 * を問わず呼び出せる。
 */
import { filterGalleryArtifacts } from "./filter";
import { compressArtifacts } from "./compress";
import { arrangeArtifacts } from "./arrange";
import { assignPresentation } from "./presentation";
import { isImageArtifact } from "./artifact";

export async function deriveGalleryPhotoOrder(photoUrls: readonly string[]): Promise<string[]> {
  if (photoUrls.length === 0) return [];

  const artifacts = filterGalleryArtifacts(photoUrls);
  if (artifacts.length === 0) return [];

  const { artifacts: compressed } = await compressArtifacts(artifacts);
  const arranged = arrangeArtifacts(compressed).filter(isImageArtifact);
  const presented = assignPresentation(arranged);

  const occupy = presented.filter((p) => p.primitive === "Occupy").map((p) => p.artifact.url);
  const rest = presented.filter((p) => p.primitive !== "Occupy").map((p) => p.artifact.url);
  return [...occupy, ...rest];
}
