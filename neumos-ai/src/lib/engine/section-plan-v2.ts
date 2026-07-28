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
 *
 * 第3引数`options`はBrand Director接続用の任意拡張（省略時は既存動作と完全に
 * 同一）。`options.photoPlan`を渡すと内部での`buildPhotoPlan`計算を上書きできる
 * （brand-director/v2-connector.tsがBrandPlan.photoAssignments由来のPhotoPlanを
 * 渡す場合に使う）。`options.layoutVariant`が"immersive"の場合のみ、写真を
 * より早く見せるためphotoStoryをstoryより前へ繰り上げる（写真が無ければ何も
 * 変わらない）。それ以外の値・省略時はブロック順を一切変更しない。
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
  | "cta"
  /** BrandPlan.ctaStrategy.placement==="after-story"の場合にのみ挿入される、控えめな早期CTA。 */
  | "ctaEarly";

export interface CafeV2Plan {
  photoPlan: PhotoPlan;
  /** 表示するブロックを表示順に並べたもの。 */
  blocks: CafeV2BlockId[];
}

export interface CafeV2PlanOptions {
  /** 指定時、内部の`buildPhotoPlan(brief.realData?.photoUrls)`計算を上書きする。 */
  photoPlan?: PhotoPlan;
  layoutVariant?: "immersive" | "editorial" | "direct";
}

function promotePhotoStory(blocks: CafeV2BlockId[]): CafeV2BlockId[] {
  const withoutPhotoStory = blocks.filter((b) => b !== "photoStory");
  const heroIndex = withoutPhotoStory.indexOf("hero");
  const insertAfterIndex = withoutPhotoStory[heroIndex + 1] === "signature" ? heroIndex + 1 : heroIndex;
  return [
    ...withoutPhotoStory.slice(0, insertAfterIndex + 1),
    "photoStory",
    ...withoutPhotoStory.slice(insertAfterIndex + 1),
  ];
}

export function buildCafeV2Plan(
  brief: StoreBrief,
  contents: GeneratedWebsiteContents,
  options?: CafeV2PlanOptions
): CafeV2Plan {
  const photoPlan = options?.photoPlan ?? buildPhotoPlan(brief.realData?.photoUrls);
  const hasSignature = contents.sections.some((s) => s.kind === "feature");
  const hasMenu =
    contents.sections.some((s) => s.kind === "service") || (brief.realData?.menuItems?.length ?? 0) > 0;
  const hasTrust =
    typeof brief.realData?.googleRating === "number" ||
    !!brief.realData?.googleReviewCount ||
    !!brief.realData?.instagramUrl;
  const hasPhotoStory = photoPlan.galleryPhotoUrls.length > 0;

  // Hero→Story→Gallery→Menu→Review→CTAの順（Phase3のセクション間リズム設計に
  // 合わせた並び）。concept（コンセプト文）は常に生成されるため、storyは常に表示する。
  const blocks: CafeV2BlockId[] = ["hero"];
  if (hasSignature) blocks.push("signature");
  blocks.push("story");
  if (hasPhotoStory) blocks.push("photoStory");
  if (hasMenu) blocks.push("menu");
  if (hasTrust) blocks.push("trust");
  // mapQueryは常に組み立て可能なため、accessHoursは常に表示する。
  blocks.push("accessHours", "cta");

  if (options?.layoutVariant === "immersive" && hasPhotoStory) {
    return { photoPlan, blocks: promotePhotoStory(blocks) };
  }
  return { photoPlan, blocks };
}
