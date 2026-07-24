import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
import { resolveTheme } from "@/lib/theme";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { About } from "./About";
import { Service } from "./Service";
import { Feature } from "./Feature";
import { Gallery } from "./Gallery";
import { Faq } from "./Faq";
import { Access } from "./Access";
import { Contact } from "./Contact";
import { Footer } from "./Footer";

/**
 * generatedContents から実際に公開可能なホームページをNext.jsコンポーネントとして描画する
 * Website Renderer 本体。Hero/About/Service/Feature/Gallery/FAQ/Access/Contact/Footer の
 * 9セクションを必ず描画する（各データはengine側で不足時に補完済み）。
 *
 * 業種別デザインテーマ（配色・余白・フォント・カード意匠）は`resolveTheme`で
 * 一度だけ解決し、各セクションへpropとして渡す。
 */
export function WebsiteRenderer({ brief, contents }: { brief: StoreBrief; contents: GeneratedWebsiteContents }) {
  const aboutSections = contents.sections.filter((s) => s.kind === "about");
  const serviceSections = contents.sections.filter((s) => s.kind === "service");
  const featureSections = contents.sections.filter((s) => s.kind === "feature");
  const theme = resolveTheme(brief.industry);

  // 同じ写真URLが重複して渡された場合、About/Galleryで同じ写真が複数回
  // 表示されてしまうため、実写真は一度だけ重複排除してから各セクションへ渡す。
  // Aboutの店舗紹介写真には先頭の1枚を使い、Galleryはその次の写真から並べる
  // ことで、同一ページ内に全く同じ写真が2箇所表示されるのを避ける。
  const dedupedPhotoUrls = brief.realData?.photoUrls
    ? Array.from(new Set(brief.realData.photoUrls))
    : undefined;
  const aboutPhotoUrl = dedupedPhotoUrls?.[0];
  const galleryPhotoUrls = dedupedPhotoUrls?.slice(1);
  const realData = brief.realData
    ? { ...brief.realData, photoUrls: dedupedPhotoUrls ? [aboutPhotoUrl].filter((u): u is string => !!u) : undefined }
    : undefined;

  return (
    <div className="bg-white">
      <Header storeName={brief.storeName} theme={theme} />
      <main>
        <Hero
          heroTitle={contents.heroTitle}
          heroSubtitle={contents.heroSubtitle}
          ctaLabel={contents.cta.buttonLabel}
          ctaHref={contents.cta.href}
          industry={brief.industry}
          area={brief.area}
          theme={theme}
        />
        <About
          storeName={brief.storeName}
          concept={contents.concept}
          sections={aboutSections}
          theme={theme}
          realData={realData}
        />
        <Service sections={serviceSections} offer={brief.offer} theme={theme} />
        <Feature sections={featureSections} theme={theme} />
        <Gallery items={contents.gallery} theme={theme} photoUrls={galleryPhotoUrls} />
        <Faq items={contents.faq} theme={theme} />
        <Access access={contents.access} storeName={brief.storeName} theme={theme} />
        <Contact cta={contents.cta} contactMethods={contents.contactMethods} theme={theme} />
      </main>
      <Footer storeName={brief.storeName} area={brief.area} industry={brief.industry} theme={theme} />
    </div>
  );
}
