/**
 * 編集パイプラインのFilter段。
 * neumos-ai/docs/design/editorial-pipeline-design.md 6章・5章に対応。
 *
 * 責務は次の4点のみ(意味・重要度・ブランド性・主役の判断はしない):
 *  1. 空データ・無効データの除外
 *  2. Editorial/Utility分離(フィールド単位の固定ルール。内容による判断はしない)
 *  3. 技術上限の適用(既存selectDisplayPhotosの12枚均等サンプリングをそのまま使う)
 *  4. 既存の写真上限・URL重複排除との統合(photo-curation.tsを新規実装せず再利用)
 */
import type { ContactMethod, GeneratedWebsiteContents, RealMenuItem, StoreBrief } from "@/lib/types";
import { canonicalizePhotoUrl, selectDisplayPhotos } from "@/lib/engine/photo-curation";
import { type Artifact, isImageArtifact, isTextArtifact, toArtifacts } from "./artifact";

/**
 * 常にUtility側に固定されるフィールド。5章の通り、内容に関わらず
 * Artifactを経由せずここへ直接マッピングする(判断ロジックを持たない)。
 */
export interface UtilityFacts {
  address?: string;
  phone?: string;
  openingHours?: string[];
  closedDays?: string;
  mapQuery?: string;
  googleMapsUrl?: string;
  instagramUrl?: string;
  googleRating?: number;
  googleReviewCount?: number;
  /** 名前・価格の一覧。来店前に確認する実用情報として扱う(説明文はtoArtifacts側でEditorial候補になり得る)。 */
  menuItems?: RealMenuItem[];
  contactMethods?: ContactMethod[];
  ctaHref?: string;
}

export interface FilterResult {
  editorial: Artifact[];
  utility: UtilityFacts;
}

export function buildUtilityFacts(brief: StoreBrief, contents: GeneratedWebsiteContents): UtilityFacts {
  const realData = brief.realData;
  return {
    address: realData?.address,
    phone: realData?.phone,
    openingHours: realData?.openingHours,
    closedDays: realData?.closedDays,
    mapQuery: contents.access?.mapQuery,
    googleMapsUrl: realData?.googleMapsUrl,
    instagramUrl: realData?.instagramUrl,
    googleRating: realData?.googleRating,
    googleReviewCount: realData?.googleReviewCount,
    menuItems: realData?.menuItems,
    contactMethods: contents.contactMethods,
    ctaHref: contents.cta?.href,
  };
}

/**
 * `brief`/`contents`からEditorial候補を抽出し、(a)空・無効データ除外、
 * (b)技術上限(既存の重複排除+12枚均等サンプリング)を適用する。
 * どのURLを残すかは`selectDisplayPhotos`の判定に完全に委ね、ここでは
 * 「候補である画像Artifactのうち、選抜結果に含まれるものだけを残す」
 * というマッピングのみ行う(選抜アルゴリズム自体は再実装しない)。
 */
function filterImages(images: readonly Artifact[]): Artifact[] {
  const urls = images.filter(isImageArtifact).map((a) => a.url);
  const { selected } = selectDisplayPhotos(urls);
  const selectedCanonical = new Set(selected.map(canonicalizePhotoUrl));

  const kept: Artifact[] = [];
  const seenCanonical = new Set<string>();
  for (const image of images) {
    if (!isImageArtifact(image)) continue;
    const canonical = canonicalizePhotoUrl(image.url);
    if (!selectedCanonical.has(canonical)) continue;
    // 元データに同一URL(正規化後)が複数件あっても、Artifactとしては1件だけ残す
    // (selectDisplayPhotos自身が重複排除済みのURL集合を返すため、それに合わせる)。
    if (seenCanonical.has(canonical)) continue;
    seenCanonical.add(canonical);
    kept.push(image);
  }
  return kept;
}

export function filterArtifacts(brief: StoreBrief, contents: GeneratedWebsiteContents): FilterResult {
  const artifacts = toArtifacts(brief, contents);

  const texts = artifacts.filter(isTextArtifact).filter((a) => a.charCount > 0);
  const images = filterImages(artifacts);

  const editorial = [...images, ...texts].sort((a, b) => a.sourceOrder - b.sourceOrder);

  return { editorial, utility: buildUtilityFacts(brief, contents) };
}
