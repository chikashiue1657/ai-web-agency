/**
 * カフェv2のセクション構成決定（純関数・v1には影響しない）。
 *
 * 既存のWebsiteRendererはHero/About/Service/Feature/Gallery/FAQ/Access/Contactを
 * セクション数固定で必ず縦に並べる。カフェv2は「情報を並べる」構造そのものを
 * やめるため、realData・生成セクションの有無を見て、実際にデータがある
 * ブロックだけを並べる可変構成にする。
 *
 * データが無いブロックを無理に表示しない（=空のカードや「準備中」のような
 * 埋め草を出さない）ことが目的なので、ここでは「出すか出さないか」だけを
 * 決め、文言の穴埋めは一切行わない。
 */
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import { buildPhotoPlan, type PhotoPlan } from "./photo-strategy";

export type CafeV2BlockId =
  | "hero"
  | "signature"
  | "photoStory"
  | "story"
  | "menu"
  | "trust"
  | "accessHours"
  | "cta";

export interface CafeV2Plan {
  photoPlan: PhotoPlan;
  /** 表示するブロックを表示順に並べたもの。 */
  blocks: CafeV2BlockId[];
}

export function buildCafeV2Plan(brief: StoreBrief, contents: GeneratedWebsiteContents): CafeV2Plan {
  const photoPlan = buildPhotoPlan(brief.realData?.photoUrls);
  const hasSignature = contents.sections.some((s) => s.kind === "feature");
  const hasMenu = contents.sections.some((s) => s.kind === "service");
  const hasTrust = typeof brief.realData?.googleRating === "number" || !!brief.realData?.googleReviewCount;

  // Hero→Story→Gallery→Menu→Review→CTAの順（Phase3のセクション間リズム設計に
  // 合わせた並び）。concept（コンセプト文）は常に生成されるため、storyは常に表示する。
  const blocks: CafeV2BlockId[] = ["hero"];
  if (hasSignature) blocks.push("signature");
  blocks.push("story");
  if (photoPlan.galleryPhotoUrls.length > 0) blocks.push("photoStory");
  if (hasMenu) blocks.push("menu");
  if (hasTrust) blocks.push("trust");
  // mapQueryは常に組み立て可能なため、accessHoursは常に表示する。
  blocks.push("accessHours", "cta");

  return { photoPlan, blocks };
}
