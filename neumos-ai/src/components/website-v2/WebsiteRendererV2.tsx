import type { ReactNode } from "react";
import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import { classifyIndustry } from "@/lib/engine/industry";
import { resolveTheme } from "@/lib/theme";
import { resolveCafeThemeV2 } from "@/lib/theme-v2";
import { buildCafeV2Plan, type CafeV2BlockId } from "@/lib/engine/section-plan-v2";
import { getSectionGapClass } from "@/lib/engine/section-rhythm-v2";
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

/**
 * カフェ業態限定の新デザインエンジン（v2）。
 *
 * v1の`WebsiteRenderer`（9セクション固定・カード多用）は一切変更せず、この
 * コンポーネントは新規ルート`/preview/[requestId]/v2`からのみ呼ばれる。
 * カフェ以外の業種でこのルートにアクセスした場合は、まだ対応していない旨を
 * 明示した上でv1の描画へフォールバックする（他業種を勝手にv2化しない）。
 */
export function WebsiteRendererV2({ brief, contents }: { brief: StoreBrief; contents: GeneratedWebsiteContents }) {
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

  const theme = resolveCafeThemeV2();
  const plan = buildCafeV2Plan(brief, contents);
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
      />
    ),
    signature: <SignatureV2 items={signatureItems} theme={theme} />,
    photoStory: (
      <PhotoStoryV2 storeName={brief.storeName} photoUrls={plan.photoPlan.galleryPhotoUrls} theme={theme} />
    ),
    story: (
      <StoryV2
        storeName={brief.storeName}
        concept={contents.concept}
        sections={aboutSections}
        photoUrl={plan.photoPlan.storyPhotoUrl}
        theme={theme}
      />
    ),
    menu: <MenuV2 sections={serviceSections} offer={brief.offer} theme={theme} />,
    trust: (
      <TrustV2
        googleRating={brief.realData?.googleRating}
        googleReviewCount={brief.realData?.googleReviewCount}
        reviews={brief.realData?.reviews}
        theme={theme}
      />
    ),
    accessHours: (
      <AccessHoursV2 storeName={brief.storeName} access={contents.access} realData={brief.realData} theme={theme} />
    ),
    cta: <CTAV2 cta={contents.cta} contactMethods={contents.contactMethods} theme={theme} />,
  };

  return (
    <div className={theme.paperBg}>
      <HeaderV2 storeName={brief.storeName} blocks={plan.blocks} />
      <main>
        {plan.blocks.map((block, i) => {
          const prevBlock = i === 0 ? null : plan.blocks[i - 1];
          return (
            <div key={block} className={getSectionGapClass(prevBlock, block)}>
              {blockRenderer[block]}
            </div>
          );
        })}
      </main>
      <Footer storeName={brief.storeName} area={brief.area} industry={brief.industry} theme={resolveTheme(brief.industry)} />
    </div>
  );
}
