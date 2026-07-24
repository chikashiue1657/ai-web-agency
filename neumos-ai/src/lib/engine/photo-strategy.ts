/**
 * カフェv2の写真配分（純関数・v1には影響しない）。
 *
 * Google Places API は「これが商品写真」「これが外観」という意味タグを返さない
 * ため、商品→店内→外観→スタッフのような意味的な優先順位は実装できない。
 * ここでは Places が返す並び順（先頭を代表写真として扱う実務上の慣習）を
 * そのままHero優先度として使う、位置ベースの割当てにとどめる。
 *
 * 同じ写真をHeroと他セクションへ重複して渡さないよう、必ず重複排除してから
 * 先頭をHero用、残りをストーリー用に分配する。
 */
export type PhotoTier = "none" | "single" | "few" | "many";

export interface PhotoPlan {
  tier: PhotoTier;
  /** Heroの背景に使う1枚。tierが"none"の場合は無い。 */
  heroPhotoUrl?: string;
  /** Hero以外（PhotoStory等）で使える残りの写真。重複なし。 */
  storyPhotoUrls: string[];
}

/** 2〜3枚を"few"（非対称の少数グリッド）、4枚以上を"many"（モザイク）として扱う閾値。 */
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
    return { tier, storyPhotoUrls: [] };
  }

  const [heroPhotoUrl, ...storyPhotoUrls] = deduped;
  return { tier, heroPhotoUrl, storyPhotoUrls };
}
