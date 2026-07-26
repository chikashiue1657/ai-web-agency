import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { HeroComposition } from "@/lib/engine/v2-design-system";
import { ParallaxImageV2 } from "./ParallaxImageV2";

interface HeroV2Props {
  storeName: string;
  heroTitle: string;
  heroSubtitle: string;
  area: string;
  industry: string;
  photoUrl?: string;
  ctaLabel: string;
  ctaHref: string;
  theme: CafeThemeV2;
  /** BrandPlan由来の構図（写真0枚なら呼び出し側が"typographic"を渡す）。 */
  composition: HeroComposition;
  /** typographyScaleに応じた見出しサイズ（resolveTypographyClasses(...).heroTitle）。 */
  heroTitleClass: string;
}

/** Hero（写真あり・全面/色面のいずれも白文字）の入口CTA。ページ末尾のCTAセクションとは別。 */
function HeroEntryLink({ ctaLabel, ctaHref }: { ctaLabel: string; ctaHref: string }) {
  return (
    <a
      href={ctaHref}
      className="mt-8 inline-flex w-fit items-center gap-2 border-b border-white/70 pb-1 text-sm font-medium text-white transition hover:gap-3 hover:border-white sm:text-base"
    >
      {ctaLabel}
      <span aria-hidden>→</span>
    </a>
  );
}

/** 明るい背景（split-frame/overlap-editorial）用の入口CTA。 */
function HeroEntryLinkOnLight({
  ctaLabel,
  ctaHref,
  theme,
}: {
  ctaLabel: string;
  ctaHref: string;
  theme: CafeThemeV2;
}) {
  return (
    <a
      href={ctaHref}
      className={`mt-6 inline-flex w-fit items-center gap-2 border-b border-current pb-1 text-sm font-medium transition hover:gap-3 sm:mt-8 sm:text-base ${theme.accentText}`}
    >
      {ctaLabel}
      <span aria-hidden>→</span>
    </a>
  );
}

function EyebrowLabel({ area, industry, tone, theme }: { area: string; industry: string; tone: "light" | "dark"; theme: CafeThemeV2 }) {
  return (
    <span
      className={`mb-4 block w-fit text-[11px] font-medium tracking-wide sm:text-xs ${
        tone === "light" ? "text-white/80" : theme.accentText
      }`}
    >
      {area} ・ {industry}
    </span>
  );
}

/**
 * "full-bleed-center"（layoutVariant="immersive"）: 写真を画面いっぱいに敷き、
 * 下部グラデーション＋左下寄せテキストのみで見せる、最も没入感の強い構図。
 * このデザイン刷新前からの既定の見た目と同一（回帰させないため変更していない）。
 */
function FullBleedCenterHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: HeroV2Props & { photoUrl: string }) {
  return (
    <section id="top" className="relative h-dvh min-h-[640px] w-full overflow-hidden">
      <ParallaxImageV2 src={photoUrl} alt={`${storeName}の店内の様子`} />
      <div className={`absolute inset-0 ${theme.heroOverlay}`} />

      <div className="relative flex h-full w-full flex-col justify-end px-5 pb-14 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <EyebrowLabel area={area} industry={industry} tone="light" theme={theme} />
        <h1
          className={`max-w-[13ch] break-keep break-words text-white [text-wrap:balance] sm:max-w-2xl sm:[overflow-wrap:normal] ${heroTitleClass} ${theme.displayFont}`}
        >
          {heroTitle}
        </h1>
        <p className="mt-5 max-w-[26ch] break-keep break-words text-sm leading-relaxed text-white/85 sm:max-w-md sm:text-base sm:[overflow-wrap:normal]">
          {heroSubtitle}
        </p>
        <HeroEntryLink ctaLabel={ctaLabel} ctaHref={ctaHref} />
      </div>

      <div
        aria-hidden
        className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-white/60 motion-safe:animate-pulse sm:flex"
      >
        <span className="h-8 w-px bg-white/40" />
      </div>
    </section>
  );
}

/**
 * "split-frame"（layoutVariant="editorial"）: 写真を全面に敷かず、左右非対称の
 * 2分割にする。モバイルは写真（枠付き）を上、テキストパネルを下に積む。
 */
function SplitFrameHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: HeroV2Props & { photoUrl: string }) {
  return (
    <section id="top" className={`w-full ${theme.paperBg}`}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,44%)_1fr]">
        <div className="order-2 flex flex-col justify-center px-5 py-14 sm:px-10 sm:py-20 lg:order-1 lg:px-16">
          <EyebrowLabel area={area} industry={industry} tone="dark" theme={theme} />
          <h1
            className={`max-w-[15ch] break-keep break-words [text-wrap:balance] sm:max-w-lg ${heroTitleClass} ${theme.displayFont} ${theme.bodyText}`}
          >
            {heroTitle}
          </h1>
          <p className={`mt-5 max-w-[34ch] break-keep break-words text-sm leading-relaxed sm:max-w-sm sm:text-base ${theme.bodyTextSoft}`}>
            {heroSubtitle}
          </p>
          <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        </div>

        <div className="relative order-1 aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[560px]">
          <div className="absolute inset-3 overflow-hidden sm:inset-6 lg:inset-8">
            <ParallaxImageV2 src={photoUrl} alt={`${storeName}の店内の様子`} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * "overlap-editorial"（layoutVariant="direct"、既定）: 写真を余白付きで枠内に収め、
 * テキストカードをその角へ重ねる、雑誌の特集扉のような構図。
 */
function OverlapEditorialHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: HeroV2Props & { photoUrl: string }) {
  return (
    <section id="top" className={`w-full ${theme.paperBg} px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-14 lg:px-12 lg:pb-20`}>
      <div className="relative mx-auto max-w-6xl">
        <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9]">
          <ParallaxImageV2 src={photoUrl} alt={`${storeName}の店内の様子`} />
        </div>

        {/*
          カードは常に通常フロー内に置く（absolute+translateは使わない）。カードの
          実際の高さはコンテンツ量で変わるため、絶対配置＋固定スペーサーの組み合わせは
          高さの見積もりを誤ると後続セクションと視覚的に衝突する（実際に発生した不具合）。
          negative marginで写真に食い込ませる方式なら、後続の兄弟要素は常にカードの
          実高さの分だけ正しく押し下げられる。
        */}
        <div
          className={`relative z-10 mx-4 -mt-16 max-w-md ${theme.paperRaisedBg} px-6 py-8 shadow-sm sm:mx-10 sm:-mt-24 sm:px-10 sm:py-10 lg:mx-16 lg:-mt-28 lg:max-w-xl lg:px-12 lg:py-12`}
        >
          <EyebrowLabel area={area} industry={industry} tone="dark" theme={theme} />
          <h1
            className={`max-w-[14ch] break-keep break-words [text-wrap:balance] ${heroTitleClass} ${theme.displayFont} ${theme.bodyText}`}
          >
            {heroTitle}
          </h1>
          <p className={`mt-4 max-w-[30ch] break-keep break-words text-sm leading-relaxed ${theme.bodyTextSoft}`}>
            {heroSubtitle}
          </p>
          <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        </div>
      </div>
    </section>
  );
}

/** 写真0枚（composition="typographic"）: 色面と大型タイポグラフィだけで空気感を出す。 */
function TypographicHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: HeroV2Props) {
  return (
    <section id="top" className="relative flex min-h-[85dvh] w-full items-end overflow-hidden sm:min-h-[90dvh]">
      <div className={`absolute inset-0 ${theme.heroNoPhotoBg}`}>
        <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-amber-100/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-1/4 h-96 w-96 rounded-full bg-amber-100/5 blur-3xl" />
      </div>

      <div className="relative flex w-full flex-col px-5 pb-14 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <EyebrowLabel area={area} industry={industry} tone="light" theme={theme} />
        <h1
          className={`max-w-[13ch] break-keep break-words [text-wrap:balance] sm:max-w-2xl sm:[overflow-wrap:normal] ${heroTitleClass} ${theme.displayFont} ${theme.heroNoPhotoText}`}
        >
          {heroTitle}
        </h1>
        <p className="mt-5 max-w-[26ch] break-keep break-words text-sm leading-relaxed text-white/85 sm:max-w-md sm:text-base sm:[overflow-wrap:normal]">
          {heroSubtitle}
        </p>
        <HeroEntryLink ctaLabel={ctaLabel} ctaHref={ctaHref} />
      </div>
    </section>
  );
}

/**
 * カフェv2のHero。BrandPlan由来の`composition`により4種の構図を切り替える
 * （写真が無ければ呼び出し側が常に"typographic"を渡すため、このコンポーネント
 * 自身も念のため`photoUrl`の有無を最終防波堤としてチェックする）。
 * 「制作会社側の説明」は一切書かず、店の空気感・見出しコピー・単一のCTAのみを見せる。
 */
export function HeroV2(props: HeroV2Props) {
  const { photoUrl, composition } = props;

  if (!photoUrl || composition === "typographic") {
    return <TypographicHero {...props} />;
  }
  if (composition === "split-frame") {
    return <SplitFrameHero {...props} photoUrl={photoUrl} />;
  }
  if (composition === "overlap-editorial") {
    return <OverlapEditorialHero {...props} photoUrl={photoUrl} />;
  }
  return <FullBleedCenterHero {...props} photoUrl={photoUrl} />;
}
