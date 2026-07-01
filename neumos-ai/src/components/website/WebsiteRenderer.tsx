import type { GeneratedWebsiteContents, StoreBrief } from "@/lib/types";
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
 */
export function WebsiteRenderer({ brief, contents }: { brief: StoreBrief; contents: GeneratedWebsiteContents }) {
  const aboutSections = contents.sections.filter((s) => s.kind === "about");
  const serviceSections = contents.sections.filter((s) => s.kind === "service");
  const featureSections = contents.sections.filter((s) => s.kind === "feature");

  return (
    <div className="bg-white">
      <Header storeName={brief.storeName} />
      <main>
        <Hero
          heroTitle={contents.heroTitle}
          heroSubtitle={contents.heroSubtitle}
          ctaLabel={contents.cta.buttonLabel}
          industry={brief.industry}
          area={brief.area}
        />
        <About concept={contents.concept} sections={aboutSections} />
        <Service sections={serviceSections} offer={brief.offer} />
        <Feature sections={featureSections} />
        <Gallery items={contents.gallery} />
        <Faq items={contents.faq} />
        <Access access={contents.access} storeName={brief.storeName} />
        <Contact cta={contents.cta} contactMethods={contents.contactMethods} />
      </main>
      <Footer storeName={brief.storeName} area={brief.area} industry={brief.industry} />
    </div>
  );
}
