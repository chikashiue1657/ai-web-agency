/**
 * Gallery専用の最小限のFilter。
 *
 * 以前はページ全体のEditorial/Utility分離(UtilityFacts等)を担っていたが、
 * ページ全体Rendererとしての編集パイプラインの利用を撤回したため、その責務は
 * 不要になった(Utility情報は引き続き既存のAccessHoursV2/CTAV2/Footerが
 * 直接扱う)。ここに残すのは、Gallery用の写真URL配列を`compress`/`arrange`/
 * `presentation`が扱える`ImageArtifact[]`へ変換する最小限の処理のみ。
 */
import { type ImageArtifact } from "./artifact";

export function filterGalleryArtifacts(urls: readonly string[]): ImageArtifact[] {
  return urls
    .filter((url) => url.trim().length > 0)
    .map((url, i) => ({
      id: `gallery-photo:${i}`,
      media: "image" as const,
      sourceOrder: i,
      url,
      absorbedCount: 0,
    }));
}
