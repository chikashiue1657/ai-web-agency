import type { ReactNode } from "react";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import { classifyIndustry } from "@/lib/engine/industry";
import { resolveTheme } from "@/lib/theme";
import { resolveCafeThemeV2 } from "@/lib/theme-v2";
import { buildCafeV2Plan, type CafeV2BlockId } from "@/lib/engine/section-plan-v2";
import { getSectionGapClass } from "@/lib/engine/section-rhythm-v2";
import {
  deriveArtDirection,
  deriveHeaderTheme,
  resolveSurfaceClasses,
  resolveTypographyClasses,
  resolveV2DesignTokens,
} from "@/lib/engine/v2-design-system";
import { derivePhotoPlanFromBrandPlan } from "@/lib/brand-director/v2-connector";
import type { BrandPlan } from "@/lib/brand-director/types";
import { splitBulletLines } from "@/components/website/utils";
import { WebsiteRenderer } from "@/components/website/WebsiteRenderer";
import { Footer } from "@/components/website/Footer";
import { HeaderV2 } from "./HeaderV2";
import { HeroV2 } from "./HeroV2";
import { SignatureV2 } from "./SignatureV2";
import { PhotoStoryV2 } from "./PhotoStoryV2";
import { StoryV2 } from "./StoryV2";
import { MenuV2 } from "./MenuV2";
import { TrustV2 } from "./TrustV2";
import { AccessHoursV2 } from "./AccessHoursV2";
import { CTAV2 } from "./CTAV2";
import { MobileStickyCtaV2 } from "./MobileStickyCtaV2";
import { SupplementalImageV2 } from "./SupplementalImageV2";

/** storyの直後へblockIdを1件挿入する（既に存在する場合や対象が無い場合は何もしない）。 */
function insertAfterStory(blocks: CafeV2BlockId[], blockId: CafeV2BlockId): CafeV2BlockId[] {
  const storyIndex = blocks.indexOf("story");
  if (storyIndex === -1 || blocks.includes(blockId)) return blocks;
  return [...blocks.slice(0, storyIndex + 1), blockId, ...blocks.slice(storyIndex + 1)];
}

/**
 * カフェ業態限定の新デザインエンジン（v2・「旗艦プレミアムデザイン」）。
 *
 * v1の`WebsiteRenderer`（9セクション固定・カード多用）は一切変更せず、この
 * コンポーネントは新規ルート`/preview/[requestId]/v2`からのみ呼ばれる。
 * カフェ以外の業種でこのルートにアクセスした場合は、まだ対応していない旨を
 * 明示した上でv1の描画へフォールバックする（他業種を勝手にv2化しない）。
 *
 * `brandPlan`は任意（省略時は既存動作と完全に同一）。Brand Directorが実際に
 * 呼ばれるのは`generate.ts`の生成時（performGeneration内で1回だけ）であり、
 * このコンポーネント（レンダリング時）はBrand Directorを一切呼ばない。
 * 取得できなかった場合（未設定・失敗・スキーマ不正・旧レコード等）は
 * `record.brandPlan`がundefinedになるため、このコンポーネント自身はBrandPlanの
 * 有無にかかわらず安全に描画できる（`resolveV2DesignTokens`がDEFAULT_TOKENSへ
 * フォールバックする）。
 *
 * デザインの7軸（hero composition / section rhythm / image treatment /
 * typography scale / surface style / CTA style / color balance）は
 * `resolveV2DesignTokens`がBrandPlanと写真枚数から決定論的に導出する
 * （同じrequestId・同じBrandPlanなら常に同じ結果になる）。
 */
export function WebsiteRendererV2({
  brief,
  contents,
  brandPlan,
}: {
  brief: StoreBrief;
  contents: GeneratedWebsiteContents;
  brandPlan?: BrandPlan;
}) {
  const category = classifyIndustry(brief.industry);

  if (category !== "cafe") {
    return (
      <>
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800 sm:text-sm">
          v2デザインエンジンは現在カフェ業態のみ対応しています。この業種（{brief.industry}）は既存デザイン（v1）で表示しています。
        </div>
        <WebsiteRenderer brief={brief} contents={contents} />
      </>
    );
  }

  // artDirectionはbrandArchetypeだけから決まるため、写真tier依存の
  // resolveV2DesignTokens()より前に単独で導出できる（buildCafeV2Plan自体が
  // artDirectionに応じたセクション構成・写真の前後分割を必要とするため）。
  const artDirection = brandPlan ? deriveArtDirection(brandPlan.brandArchetype) : "warm-craft";
  const overridePhotoPlan = brandPlan
    ? derivePhotoPlanFromBrandPlan(brandPlan, brief.realData?.photoUrls ?? [])
    : undefined;
  const basePlan = buildCafeV2Plan(brief, contents, {
    photoPlan: overridePhotoPlan,
    layoutVariant: brandPlan?.layoutVariant,
    artDirection,
  });
  const showEarlyCta = brandPlan?.ctaStrategy.placement === "after-story";
  const plan = showEarlyCta ? { ...basePlan, blocks: insertAfterStory(basePlan.blocks, "ctaEarly") } : basePlan;

  const tokens = resolveV2DesignTokens(brandPlan, plan.photoPlan.tier);
  const theme = resolveCafeThemeV2(tokens.colorBalance, tokens.typographyScale);
  const surface = resolveSurfaceClasses(tokens.surfaceStyle);
  const typography = resolveTypographyClasses(tokens.typographyScale);

  const aboutSections = contents.sections.filter((s) => s.kind === "about");
  const featureSections = contents.sections.filter((s) => s.kind === "feature");
  const serviceSections = contents.sections.filter((s) => s.kind === "service");
  const signatureItems = featureSections.flatMap((s) => splitBulletLines(s.body));

  const blockRenderer: Partial<Record<CafeV2BlockId, ReactNode>> = {
    hero: (
      <HeroV2
        storeName={brief.storeName}
        heroTitle={contents.heroTitle}
        heroSubtitle={contents.heroSubtitle}
        area={brief.area}
        industry={brief.industry}
        photoUrl={plan.photoPlan.heroPhotoUrl}
        ctaLabel={contents.cta.buttonLabel}
        ctaHref={contents.cta.href}
        theme={theme}
        composition={tokens.heroComposition}
        heroTitleClass={typography.heroTitle}
        artDirection={tokens.artDirection}
      />
    ),
    signature: <SignatureV2 items={signatureItems} theme={theme} surface={surface} />,
    photoStory: (
      <PhotoStoryV2
        storeName={brief.storeName}
        photoUrls={plan.gallerySplit.first}
        theme={theme}
        treatment={tokens.imageTreatment}
        surface={surface}
      />
    ),
    // sensory-immersive方向・写真4枚以上の場合のみ存在する2箇所目のフォト
    // セクション（"写真→商品情報→写真"のリズムを作る。他の方向・写真が
    // 少ない場合はplan.blocksに"photoStory2"自体が含まれない）。
    photoStory2: (
      <PhotoStoryV2
        storeName={brief.storeName}
        photoUrls={plan.gallerySplit.second}
        theme={theme}
        treatment={tokens.imageTreatment}
        surface={surface}
        sectionId="photo-story-2"
      />
    ),
    story: (
      <StoryV2
        storeName={brief.storeName}
        concept={contents.concept}
        sections={aboutSections}
        photoUrl={plan.photoPlan.storyPhotoUrl}
        theme={theme}
        surface={surface}
      />
    ),
    supplementalImage: <SupplementalImageV2 image={brief.realData?.supplementalImages?.[0]} />,
    menu: (
      <MenuV2
        sections={serviceSections}
        menuItems={brief.realData?.menuItems}
        offer={brief.offer}
        salesAngle={brief.salesAngle}
        targetCustomer={brief.targetCustomer}
        theme={theme}
        surface={surface}
        sectionHeadingClass={typography.sectionHeading}
        artDirection={tokens.artDirection}
      />
    ),
    trust: (
      <TrustV2
        googleRating={brief.realData?.googleRating}
        googleReviewCount={brief.realData?.googleReviewCount}
        reviews={brief.realData?.reviews}
        instagramUrl={brief.realData?.instagramUrl}
        theme={theme}
      />
    ),
    accessHours: (
      <AccessHoursV2
        storeName={brief.storeName}
        access={contents.access}
        realData={brief.realData}
        theme={theme}
        surface={surface}
        artDirection={tokens.artDirection}
      />
    ),
    cta: (
      <CTAV2
        cta={contents.cta}
        contactMethods={contents.contactMethods}
        theme={theme}
        ctaStyle={tokens.ctaStyle}
        artDirection={tokens.artDirection}
      />
    ),
    ctaEarly: (
      <CTAV2
        cta={contents.cta}
        contactMethods={contents.contactMethods}
        theme={theme}
        variant="compact"
        ctaStyle={tokens.ctaStyle}
        artDirection={tokens.artDirection}
      />
    ),
  };

  return (
    // pb-24: モバイル固定CTAバーの高さ+safe-area分の下余白。以前はこの余白を
    // <main>だけに付けていたため、<main>の外にあるFooterがバーの下に隠れ、
    // スクロールし切ってもFooter末尾が絶対に見えない不具合があった（実際に
    // 発生を確認した）。ページ全体の末尾に対して確保する。
    <div className={`pb-24 sm:pb-0 ${theme.paperBg}`}>
      <HeaderV2
        storeName={brief.storeName}
        blocks={plan.blocks}
        theme={deriveHeaderTheme(tokens.artDirection, tokens.heroComposition)}
      />
      <main>
        {plan.blocks.map((block, i) => {
          const prevBlock = i === 0 ? null : plan.blocks[i - 1];
          return (
            <div key={`${block}-${i}`} className={getSectionGapClass(prevBlock, block, tokens.sectionRhythm)}>
              {blockRenderer[block]}
            </div>
          );
        })}
      </main>
      <Footer storeName={brief.storeName} area={brief.area} industry={brief.industry} theme={resolveTheme(brief.industry)} />
      <MobileStickyCtaV2 cta={contents.cta} theme={theme} surface={surface} ctaStyle={tokens.ctaStyle} />
    </div>
  );
}
