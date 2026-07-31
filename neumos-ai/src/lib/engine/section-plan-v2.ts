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
 * 渡す場合に使う）。`options.layoutVariant`が"immersive"の場合、写真をより早く
 * 見せるためphotoStoryをstoryより前へ繰り上げる（写真が無ければ何も変わらない）。
 *
 * `options.artDirection`が"sensory-immersive"で写真が4枚以上ある場合は、
 * ギャラリー写真を前半/後半に分け、"写真→商品情報→写真"のリズムを作るため
 * `photoStory`（前半・繰り上げ）と`photoStory2`（後半・Menuの後）の2箇所に
 * 分けて配置する（他の方向・写真が少ない場合はこれまで通り1箇所）。
 */
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import type { ArtDirection } from "./v2-design-system";
import { buildPhotoPlan, type PhotoPlan } from "./photo-strategy";

export type CafeV2BlockId =
  | "hero"
  | "signature"
  | "photoStory"
  | "story"
  | "supplementalImage"
  | "menu"
  | "trust"
  | "accessHours"
  | "cta"
  /** BrandPlan.ctaStrategy.placement==="after-story"の場合にのみ挿入される、控えめな早期CTA。 */
  | "ctaEarly"
  /** sensory-immersive方向で写真が4枚以上ある場合のみ、Menuの後に挿入される2箇所目のフォトセクション。 */
  | "photoStory2";

export interface CafeV2Plan {
  photoPlan: PhotoPlan;
  /** 表示するブロックを表示順に並べたもの。 */
  blocks: CafeV2BlockId[];
  /** photoStory/photoStory2 それぞれに実際に渡すギャラリー写真の内訳。 */
  gallerySplit: { first: string[]; second: string[] };
}

export interface CafeV2PlanOptions {
  /** 指定時、内部の`buildPhotoPlan(brief.realData?.photoUrls)`計算を上書きする。 */
  photoPlan?: PhotoPlan;
  layoutVariant?: "immersive" | "editorial" | "direct";
  artDirection?: ArtDirection;
}

function promoteBlock(blocks: CafeV2BlockId[], blockId: CafeV2BlockId): CafeV2BlockId[] {
  const without = blocks.filter((b) => b !== blockId);
  const heroIndex = without.indexOf("hero");
  const insertAfterIndex = without[heroIndex + 1] === "signature" ? heroIndex + 1 : heroIndex;
  return [...without.slice(0, insertAfterIndex + 1), blockId, ...without.slice(insertAfterIndex + 1)];
}

const MIN_PHOTOS_FOR_SPLIT_RHYTHM = 4;

export function buildCafeV2Plan(
  brief: StoreBrief,
  contents: GeneratedWebsiteContents,
  options?: CafeV2PlanOptions
): CafeV2Plan {
  const photoPlan = options?.photoPlan ?? buildPhotoPlan(brief.realData?.photoUrls);
  const hasSignature = contents.sections.some((s) => s.kind === "feature");
  const hasMenu =
    contents.sections.some((s) => s.kind === "service") || (brief.realData?.menuItems?.length ?? 0) > 0;
  // TrustV2の実際の描画条件（rating/reviewCountは両方揃って初めて表示、
  // instagramUrlは単独でも可）と一致させる。片方だけの評価は表示しないため
  // ここでもブロック自体を出さない。
  const hasTrust =
    (typeof brief.realData?.googleRating === "number" && typeof brief.realData?.googleReviewCount === "number") ||
    !!brief.realData?.instagramUrl;
  const hasPhotoStory = photoPlan.galleryPhotoUrls.length > 0;

  const splitForImmersiveRhythm =
    options?.artDirection === "sensory-immersive" &&
    photoPlan.galleryPhotoUrls.length >= MIN_PHOTOS_FOR_SPLIT_RHYTHM;
  const splitAt = Math.ceil(photoPlan.galleryPhotoUrls.length / 2);
  const gallerySplit = splitForImmersiveRhythm
    ? { first: photoPlan.galleryPhotoUrls.slice(0, splitAt), second: photoPlan.galleryPhotoUrls.slice(splitAt) }
    : { first: photoPlan.galleryPhotoUrls, second: [] };

  // Hero→Story→Gallery→Menu→Review→CTAの順（Phase3のセクション間リズム設計に
  // 合わせた並び）。concept（コンセプト文）は常に生成されるため、storyは常に表示する。
  const blocks: CafeV2BlockId[] = ["hero"];
  if (hasSignature) blocks.push("signature");
  blocks.push("story");
  if ((brief.realData?.supplementalImages?.length ?? 0) > 0) blocks.push("supplementalImage");
  if (hasPhotoStory) blocks.push("photoStory");
  if (hasMenu) blocks.push("menu");
  if (splitForImmersiveRhythm && gallerySplit.second.length > 0) blocks.push("photoStory2");
  if (hasTrust) blocks.push("trust");
  // mapQueryは常に組み立て可能なため、accessHoursは常に表示する。
  blocks.push("accessHours", "cta");

  // sensory-immersiveは写真を主役にする方向のため、layoutVariantに関わらず
  // 常にphotoStoryをHero直後へ繰り上げる（実生成ではlayoutVariantがほぼ
  // "direct"固定になるため、artDirection自体でも繰り上げを判断する必要がある）。
  const shouldPromote = (options?.layoutVariant === "immersive" || options?.artDirection === "sensory-immersive") && hasPhotoStory;
  const finalBlocks = shouldPromote ? promoteBlock(blocks, "photoStory") : blocks;

  return { photoPlan, blocks: finalBlocks, gallerySplit };
}
