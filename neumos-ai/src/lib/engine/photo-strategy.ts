/**
 * カフェv2の写真配分（純関数・v1には影響しない）。
 *
 * Google Places API は「これが商品写真」「これが外観」という意味タグを返さない
 * ため、商品→店内→外観→スタッフのような意味的な優先順位は実装できない。
 * ここでは Places が返す並び順（先頭を代表写真として扱う実務上の慣習）を
 * そのままHero優先度として使う、位置ベースの割当てにとどめる。
 *
 * 同じ写真を複数セクションへ重複して渡さないよう、必ず重複排除してから
 * Hero→Story→Gallery の順に1枚ずつ優先確保し、残りをGalleryへ渡す。
 * Storyは「本文を写真に重ねる」演出（Phase3）のため専用に1枚確保するが、
 * 写真がHero用の1枚しか無い場合はStoryを文章のみの構成に留める
 * （無理に同じ写真を使い回さない）。
 */
export type PhotoTier = "none" | "single" | "few" | "many";

export interface PhotoPlan {
  tier: PhotoTier;
  /** Heroの背景に使う1枚。tierが"none"の場合は無い。 */
  heroPhotoUrl?: string;
  /** Storyセクションに重ねる1枚。写真が2枚以上ある場合のみ確保する。 */
  storyPhotoUrl?: string;
  /** Gallery（PhotoStory）で使える残りの写真。重複なし。 */
  galleryPhotoUrls: string[];
}

/** 2〜3枚を"few"、4枚以上を"many"として扱う閾値（合計枚数の分類）。 */
const FEW_MAX = 3;

export function classifyPhotoTier(count: number): PhotoTier {
  if (count <= 0) return "none";
  if (count === 1) return "single";
  if (count <= FEW_MAX) return "few";
  return "many";
}

export function buildPhotoPlan(photoUrls?: string[]): PhotoPlan {
  const deduped = photoUrls ? Array.from(new Set(photoUrls)) : [];
  const tier = classifyPhotoTier(deduped.length);

  if (tier === "none") {
    return { tier, galleryPhotoUrls: [] };
  }

  const [heroPhotoUrl, storyPhotoUrl, ...galleryPhotoUrls] = deduped;
  if (deduped.length === 1) {
    return { tier, heroPhotoUrl, galleryPhotoUrls: [] };
  }
  return { tier, heroPhotoUrl, storyPhotoUrl, galleryPhotoUrls };
}
