/**
 * カフェv2の写真配分（純関数・v1には影響しない）。
 *
 * Google Places API は「これが商品写真」「これが外観」という意味タグを返さない
 * ため、商品→店内→外観→スタッフのような意味的な優先順位は実装できない。
 * ここでは Places が返す並び順（先頭を代表写真として扱う実務上の慣習）を
 * そのままHero優先度として使う、位置ベースの割当てにとどめる。
 *
 * 表示前に必ず`photo-curation.ts`の`selectDisplayPhotos`を通す。クエリ文字列
 * だけが異なる実質同一URLの重複排除と、上限（既定12枚）を超える場合の均等
 * サンプリングをここで一度だけ行い、以降のHero/Story/Gallery配分は常に
 * 「表示してよいと確定した配列」だけを対象にする（実データ自体は変更しない）。
 *
 * 同じ写真を複数セクションへ重複して渡さないよう、必ず重複排除してから
 * Hero→Story→Gallery の順に1枚ずつ優先確保し、残りをGalleryへ渡す。
 * Storyは「本文を写真に重ねる」演出（Phase3）のため専用に1枚確保するが、
 * 写真がHero用の1枚しか無い場合はStoryを文章のみの構成に留める
 * （無理に同じ写真を使い回さない）。
 */
import { selectDisplayPhotos } from "./photo-curation";

export type PhotoTier = "none" | "minimal" | "moderate" | "many";

export interface PhotoPlan {
  tier: PhotoTier;
  /** Heroの背景に使う1枚。tierが"none"の場合は無い。 */
  heroPhotoUrl?: string;
  /** Storyセクションに重ねる1枚。写真が2枚以上ある場合のみ確保する。 */
  storyPhotoUrl?: string;
  /** Gallery（PhotoStory）で使える残りの写真。重複なし。 */
  galleryPhotoUrls: string[];
}

/**
 * 表示に使う写真の総枚数（重複排除・上限適用後）に応じた4段階の分類。
 *  - none    : 0枚
 *  - minimal : 1〜2枚（写真主体の大きな構図には無理に寄せない）
 *  - moderate: 3〜5枚
 *  - many    : 6枚以上（`selectDisplayPhotos`の上限により実際には最大12枚）
 */
const MINIMAL_MAX = 2;
const MODERATE_MAX = 5;

export function classifyPhotoTier(count: number): PhotoTier {
  if (count <= 0) return "none";
  if (count <= MINIMAL_MAX) return "minimal";
  if (count <= MODERATE_MAX) return "moderate";
  return "many";
}

export function buildPhotoPlan(photoUrls?: string[]): PhotoPlan {
  const { selected } = selectDisplayPhotos(photoUrls);
  const tier = classifyPhotoTier(selected.length);

  if (tier === "none") {
    return { tier, galleryPhotoUrls: [] };
  }

  const [heroPhotoUrl, storyPhotoUrl, ...galleryPhotoUrls] = selected;
  if (selected.length === 1) {
    return { tier, heroPhotoUrl, galleryPhotoUrls: [] };
  }
  return { tier, heroPhotoUrl, storyPhotoUrl, galleryPhotoUrls };
}
