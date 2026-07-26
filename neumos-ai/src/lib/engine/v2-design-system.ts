/**
 * v2「旗艦プレミアムデザイン」の設計トークン解決（純関数・v1には影響しない）。
 *
 * BrandPlan（と写真枚数tier）から、次の7軸を決定論的に導出する。
 *  - heroComposition   : Heroの構図
 *  - sectionRhythm     : セクション間の余白リズムの強弱パターン
 *  - imageTreatment    : 写真の見せ方（BrandPlan.visualDirection.photoTreatmentをそのまま使う）
 *  - typographyScale   : 見出しの書体・サイズの強さ（BrandPlan.visualDirection.typographyToneをそのまま使う）
 *  - surfaceStyle      : カード・背景の質感（brandArchetypeから導出）
 *  - ctaStyle          : CTAボタンの強さ（BrandPlan.ctaStrategy.urgencyから導出）
 *  - colorBalance      : 配色（BrandPlan.visualDirection.paletteHintをそのまま使う。theme-v2.tsが実際の色トークンへ変換する）
 *
 * 同じBrandPlan・同じphotoTierを渡せば必ず同じ結果を返す（Math.random/Date.now等は
 * 一切使わない）。これはBrandPlanが生成時に一度だけ作られて記録へ保存される設計
 * （v2-connector.ts）と組み合わさることで、「同じrequestIdのv2ページは何度表示しても
 * 同じHTMLになる」という要件を満たすための前提になっている。
 *
 * brandPlanが無い場合（旧レコード・生成時にBrand Directorが使えなかった場合）は
 * DEFAULT_TOKENSを返す。これはrule-providerがカフェに対して返す典型的な既定値
 * （brandArchetype:"artisan", layoutVariant:"direct", paletteHint:"neutral",
 * typographyTone:"editorial-serif", ctaStrategy.urgency:"low"）と同じ結果になるよう
 * 選んでいるため、「BrandPlanが無い」ケースと「rule-providerの既定出力」ケースが
 * 視覚的に地続きになる（片方だけ特別扱いにしない）。
 */
import type { BrandArchetype, BrandPlan } from "@/lib/brand-director/types";
import type { PhotoTier } from "./photo-strategy";

export type HeroComposition = "full-bleed-center" | "split-frame" | "overlap-editorial" | "typographic";
export type SectionRhythm = "airy" | "dense" | "staggered";
export type ImageTreatment = "full-bleed" | "framed" | "mixed";
export type TypographyScale = "editorial-serif" | "clean-sans" | "bold-display";
export type SurfaceStyle = "paper-warm" | "flat-minimal" | "framed-card" | "raw-editorial";
export type CtaStyle = "text-link" | "outline-minimal" | "solid-bold";
export type ColorBalance = "warm" | "cool" | "neutral" | "high-contrast";

export interface V2DesignTokens {
  heroComposition: HeroComposition;
  sectionRhythm: SectionRhythm;
  imageTreatment: ImageTreatment;
  typographyScale: TypographyScale;
  surfaceStyle: SurfaceStyle;
  ctaStyle: CtaStyle;
  colorBalance: ColorBalance;
}

/** layoutVariantごとの既定Hero構図（写真がある場合）。 */
const HERO_COMPOSITION_BY_LAYOUT: Record<BrandPlan["layoutVariant"], HeroComposition> = {
  immersive: "full-bleed-center",
  editorial: "split-frame",
  direct: "overlap-editorial",
};

/** brandArchetypeごとのセクションリズム（空気感の強弱）。 */
const SECTION_RHYTHM_BY_ARCHETYPE: Record<BrandArchetype, SectionRhythm> = {
  "luxury-quiet": "airy",
  "wellness-calm": "airy",
  "energetic-casual": "dense",
  artisan: "staggered",
  "modern-minimal": "staggered",
  "warm-hospitality": "staggered",
  "heritage-traditional": "staggered",
};

/** brandArchetypeごとの質感（カード・背景の作り）。 */
const SURFACE_STYLE_BY_ARCHETYPE: Record<BrandArchetype, SurfaceStyle> = {
  artisan: "paper-warm",
  "warm-hospitality": "paper-warm",
  "heritage-traditional": "paper-warm",
  "modern-minimal": "flat-minimal",
  "luxury-quiet": "framed-card",
  "wellness-calm": "framed-card",
  "energetic-casual": "raw-editorial",
};

/** ctaStrategy.urgencyごとのCTAボタンの強さ。 */
const CTA_STYLE_BY_URGENCY: Record<BrandPlan["ctaStrategy"]["urgency"], CtaStyle> = {
  low: "text-link",
  medium: "outline-minimal",
  high: "solid-bold",
};

export const DEFAULT_TOKENS: V2DesignTokens = {
  heroComposition: "overlap-editorial",
  sectionRhythm: "staggered",
  imageTreatment: "framed",
  typographyScale: "editorial-serif",
  surfaceStyle: "paper-warm",
  ctaStyle: "text-link",
  colorBalance: "neutral",
};

export function resolveV2DesignTokens(brandPlan: BrandPlan | undefined, photoTier: PhotoTier): V2DesignTokens {
  if (!brandPlan) return DEFAULT_TOKENS;

  const tokens: V2DesignTokens = {
    heroComposition: HERO_COMPOSITION_BY_LAYOUT[brandPlan.layoutVariant],
    sectionRhythm: SECTION_RHYTHM_BY_ARCHETYPE[brandPlan.brandArchetype],
    imageTreatment: brandPlan.visualDirection.photoTreatment,
    typographyScale: brandPlan.visualDirection.typographyTone,
    surfaceStyle: SURFACE_STYLE_BY_ARCHETYPE[brandPlan.brandArchetype],
    ctaStyle: CTA_STYLE_BY_URGENCY[brandPlan.ctaStrategy.urgency],
    colorBalance: brandPlan.visualDirection.paletteHint,
  };

  // 写真が無い場合、split/overlap/full-bleedのような写真前提の構図は成立しないため、
  // タイポグラフィのみで組む構図へ必ず落とす（写真0枚で破綻させないため）。
  if (photoTier === "none") {
    tokens.heroComposition = "typographic";
  }

  return tokens;
}

/**
 * surfaceStyleごとの「浮いたカード」の質感（Menu/Signature/Trust等で共有する）。
 * "paper-warm"の値は、このデザイン刷新前から各コンポーネントに直書きされていた
 * 値（bg-white・border-stone-200）と同一にしてある（既定の見た目を保つため）。
 */
export interface SurfaceClasses {
  cardBg: string;
  cardBorder: string;
  divider: string;
}

const SURFACE_CLASSES: Record<SurfaceStyle, SurfaceClasses> = {
  "paper-warm": { cardBg: "bg-white", cardBorder: "border border-stone-200", divider: "border-stone-200" },
  "flat-minimal": { cardBg: "bg-transparent", cardBorder: "border-0", divider: "border-stone-100" },
  "framed-card": { cardBg: "bg-white", cardBorder: "border-2 border-stone-300", divider: "border-stone-300" },
  "raw-editorial": { cardBg: "bg-transparent", cardBorder: "border-b-2 border-stone-900", divider: "border-stone-900" },
};

export function resolveSurfaceClasses(style: SurfaceStyle): SurfaceClasses {
  return SURFACE_CLASSES[style];
}

/**
 * typographyScaleごとの見出しサイズ・ウェイト。"editorial-serif"の値は
 * このデザイン刷新前からHeroV2に直書きされていた値と同一にしてある。
 */
export interface TypographyClasses {
  heroTitle: string;
  sectionHeading: string;
}

const TYPOGRAPHY_CLASSES: Record<TypographyScale, TypographyClasses> = {
  "editorial-serif": {
    heroTitle: "text-4xl leading-[1.15] sm:text-6xl sm:leading-[1.05] lg:text-7xl",
    sectionHeading: "text-2xl sm:text-3xl",
  },
  "clean-sans": {
    heroTitle: "text-4xl leading-[1.1] tracking-tight sm:text-5xl sm:leading-[1.05] lg:text-6xl",
    sectionHeading: "text-xl tracking-tight sm:text-2xl",
  },
  "bold-display": {
    heroTitle: "text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl",
    sectionHeading: "text-2xl font-bold tracking-tight sm:text-4xl",
  },
};

export function resolveTypographyClasses(scale: TypographyScale): TypographyClasses {
  return TYPOGRAPHY_CLASSES[scale];
}
