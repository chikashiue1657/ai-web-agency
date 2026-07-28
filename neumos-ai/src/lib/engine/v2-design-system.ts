/**
 * v2「旗艦プレミアムデザイン」の設計トークン解決（純関数・v1には影響しない）。
 *
 * まず`brandArchetype`から3つの「アートディレクション」のいずれか1つを決定論的に
 * 決め（`deriveArtDirection`）、その方向の内部だけで残り7軸を制御する。
 * 7軸を互いに独立させて自由に掛け合わせると、方向性の一貫しない
 * 「ワイヤーフレームに色を塗っただけ」の見た目になりやすいため、
 * 各軸はartDirectionごとに許容される値の範囲へ収める（クランプする）。
 *
 *  - artDirection      : "japanese-editorial" | "sensory-immersive" | "warm-craft"
 *  - heroComposition   : Heroの構図（artDirection×layoutVariantの3x3テーブルで決定）
 *  - sectionRhythm     : セクション間の余白リズム（artDirectionごとにほぼ固定、一部archetypeで微調整）
 *  - imageTreatment    : 写真の見せ方（artDirectionごとに固定）
 *  - typographyScale   : 見出しの書体・サイズ（artDirectionごとに固定、一部archetypeで微調整）
 *  - surfaceStyle      : カード・背景の質感（artDirectionごとに固定）
 *  - ctaStyle          : CTAボタンの強さ（urgency由来の値をartDirectionの許容範囲へクランプ）
 *  - colorBalance      : 配色（BrandPlan.visualDirection.paletteHint由来の値を
 *                         artDirectionごとの許容範囲へ決定論的にクランプする。
 *                         例えばWarm Craft方向でcoolがそのまま通ると「温かい手仕事」
 *                         という方向性と矛盾するため、方向ごとに変換表を持つ）
 *
 * 同じBrandPlan・同じphotoTierを渡せば必ず同じ結果を返す（Math.random/Date.now等は
 * 一切使わない）。これはBrandPlanが生成時に一度だけ作られて記録へ保存される設計
 * （v2-connector.ts）と組み合わさることで、「同じrequestIdのv2ページは何度表示しても
 * 同じHTMLになる」という要件を満たすための前提になっている。
 *
 * brandPlanが無い場合（旧レコード・生成時にBrand Directorが使えなかった場合）は
 * DEFAULT_TOKENSを返す。これはrule-providerがカフェに対して返す典型的な既定値
 * （brandArchetype:"artisan" → warm-craft方向、layoutVariant:"direct"、
 * paletteHint:"neutral", ctaStrategy.urgency:"low"）と同じ結果になるよう
 * 選んでいるため、「BrandPlanが無い」ケースと「rule-providerの既定出力」ケースが
 * 視覚的に地続きになる（片方だけ特別扱いにしない）。
 */
import type { BrandArchetype, BrandPlan } from "@/lib/brand-director/types";
import type { PhotoTier } from "./photo-strategy";

export type ArtDirection = "japanese-editorial" | "sensory-immersive" | "warm-craft";
export type HeroComposition = "full-bleed-center" | "split-frame" | "overlap-editorial" | "typographic";
export type SectionRhythm = "airy" | "dense" | "staggered";
export type ImageTreatment = "full-bleed" | "framed" | "mixed";
export type TypographyScale = "editorial-serif" | "clean-sans" | "bold-display";
export type SurfaceStyle = "paper-warm" | "flat-minimal" | "framed-card" | "raw-editorial";
export type CtaStyle = "text-link" | "outline-minimal" | "solid-bold";
export type ColorBalance = "warm" | "cool" | "neutral" | "high-contrast";

export interface V2DesignTokens {
  artDirection: ArtDirection;
  heroComposition: HeroComposition;
  sectionRhythm: SectionRhythm;
  imageTreatment: ImageTreatment;
  typographyScale: TypographyScale;
  surfaceStyle: SurfaceStyle;
  ctaStyle: CtaStyle;
  colorBalance: ColorBalance;
}

/**
 * brandArchetype(7種)をart direction(3種)へ過不足なく1:1以上で分類する。
 * heritage-traditional/modern-minimal/wellness-calm → 静かな読み物のような
 * Japanese Editorial。luxury-quiet/energetic-casual → 写真主役で没入感の強い
 * Sensory Immersive。artisan/warm-hospitality → 温かい手仕事感のWarm Craft。
 */
const ART_DIRECTION_BY_ARCHETYPE: Record<BrandArchetype, ArtDirection> = {
  "heritage-traditional": "japanese-editorial",
  "modern-minimal": "japanese-editorial",
  "wellness-calm": "japanese-editorial",
  "luxury-quiet": "sensory-immersive",
  "energetic-casual": "sensory-immersive",
  artisan: "warm-craft",
  "warm-hospitality": "warm-craft",
};

export function deriveArtDirection(brandArchetype: BrandArchetype): ArtDirection {
  return ART_DIRECTION_BY_ARCHETYPE[brandArchetype];
}

/** artDirection×layoutVariantでHero構図を決める（写真がある場合）。方向を跨いだ構図は出さない。 */
const HERO_COMPOSITION_TABLE: Record<ArtDirection, Record<BrandPlan["layoutVariant"], HeroComposition>> = {
  "japanese-editorial": { immersive: "split-frame", editorial: "split-frame", direct: "split-frame" },
  "sensory-immersive": { immersive: "full-bleed-center", editorial: "full-bleed-center", direct: "overlap-editorial" },
  "warm-craft": { immersive: "overlap-editorial", editorial: "split-frame", direct: "overlap-editorial" },
};

/** artDirectionごとの基本セクションリズム。energetic-casualだけdenseへ寄せる。 */
function resolveSectionRhythm(artDirection: ArtDirection, brandArchetype: BrandArchetype): SectionRhythm {
  if (artDirection === "japanese-editorial") return "airy";
  if (artDirection === "warm-craft") return "staggered";
  return brandArchetype === "energetic-casual" ? "dense" : "airy";
}

/** artDirectionごとの写真の見せ方。方向の性格をもっとも強く表す軸の1つ。 */
const IMAGE_TREATMENT_BY_DIRECTION: Record<ArtDirection, ImageTreatment> = {
  "japanese-editorial": "framed",
  "sensory-immersive": "mixed",
  "warm-craft": "full-bleed",
};

/** artDirectionごとのタイポグラフィスケール。sensory-immersiveだけarchetypeで微調整する。 */
function resolveTypographyScale(artDirection: ArtDirection, brandArchetype: BrandArchetype): TypographyScale {
  if (artDirection === "japanese-editorial") return "editorial-serif";
  if (artDirection === "warm-craft") return "editorial-serif";
  return brandArchetype === "energetic-casual" ? "bold-display" : "clean-sans";
}

/** artDirectionごとのsurface(カード・背景)の質感。 */
const SURFACE_STYLE_BY_DIRECTION: Record<ArtDirection, SurfaceStyle> = {
  "japanese-editorial": "flat-minimal",
  "sensory-immersive": "framed-card",
  "warm-craft": "paper-warm",
};

/** ctaStrategy.urgency由来の素のCTAスタイル。 */
const CTA_STYLE_BY_URGENCY: Record<BrandPlan["ctaStrategy"]["urgency"], CtaStyle> = {
  low: "text-link",
  medium: "outline-minimal",
  high: "solid-bold",
};

/**
 * artDirectionごとに許容するCTAスタイルの範囲。urgency由来の値がこの範囲外なら、
 * 範囲内でもっとも近い（同じ配列上で隣接する）値へ寄せる。
 * japanese-editorial/warm-craftはsolid-boldを許さない（静かな方向に強すぎる）。
 * sensory-immersiveはtext-linkを許さない（写真主役の力強さに対して弱すぎる）。
 */
const CTA_STYLE_ALLOWED: Record<ArtDirection, CtaStyle[]> = {
  "japanese-editorial": ["text-link", "outline-minimal"],
  "sensory-immersive": ["outline-minimal", "solid-bold"],
  "warm-craft": ["text-link", "outline-minimal"],
};

function clampCtaStyle(raw: CtaStyle, artDirection: ArtDirection): CtaStyle {
  const allowed = CTA_STYLE_ALLOWED[artDirection];
  if (allowed.includes(raw)) return raw;
  // 範囲外は「強さの順番（text-link < outline-minimal < solid-bold)」で最も近い許容値へ丸める。
  const order: CtaStyle[] = ["text-link", "outline-minimal", "solid-bold"];
  const rawIndex = order.indexOf(raw);
  const distances = allowed.map((c) => Math.abs(order.indexOf(c) - rawIndex));
  return allowed[distances.indexOf(Math.min(...distances))];
}

/**
 * artDirectionごとのcolorBalance変換表。方向の一貫性を壊す組み合わせ
 * （例: 「温かい手仕事」を掲げるWarm Craftにcoolを許す等）を決定論的に
 * 別の値へ変換する。既に方向と調和する値はそのまま通す。
 *  - Japanese Editorial: neutral/warmを中心。cool/high-contrastはneutralへ。
 *  - Sensory Immersive: neutral/cool/warm/high-contrastをすべて許可
 *    （写真主役の方向は配色の幅を狭めすぎない方が世界観を表現しやすいため）。
 *  - Warm Craft: warm/neutralのみ。cool/high-contrastはwarmへ。
 */
const COLOR_BALANCE_CLAMP: Record<ArtDirection, Record<ColorBalance, ColorBalance>> = {
  "japanese-editorial": { warm: "warm", neutral: "neutral", cool: "neutral", "high-contrast": "neutral" },
  "sensory-immersive": { warm: "warm", neutral: "neutral", cool: "cool", "high-contrast": "high-contrast" },
  "warm-craft": { warm: "warm", neutral: "neutral", cool: "warm", "high-contrast": "warm" },
};

function clampColorBalance(raw: ColorBalance, artDirection: ArtDirection): ColorBalance {
  return COLOR_BALANCE_CLAMP[artDirection][raw];
}

export const DEFAULT_TOKENS: V2DesignTokens = {
  artDirection: "warm-craft",
  heroComposition: "overlap-editorial",
  sectionRhythm: "staggered",
  imageTreatment: "full-bleed",
  typographyScale: "editorial-serif",
  surfaceStyle: "paper-warm",
  ctaStyle: "text-link",
  colorBalance: "neutral",
};

export function resolveV2DesignTokens(brandPlan: BrandPlan | undefined, photoTier: PhotoTier): V2DesignTokens {
  if (!brandPlan) return DEFAULT_TOKENS;

  const artDirection = deriveArtDirection(brandPlan.brandArchetype);

  const tokens: V2DesignTokens = {
    artDirection,
    heroComposition: HERO_COMPOSITION_TABLE[artDirection][brandPlan.layoutVariant],
    sectionRhythm: resolveSectionRhythm(artDirection, brandPlan.brandArchetype),
    imageTreatment: IMAGE_TREATMENT_BY_DIRECTION[artDirection],
    typographyScale: resolveTypographyScale(artDirection, brandPlan.brandArchetype),
    surfaceStyle: SURFACE_STYLE_BY_DIRECTION[artDirection],
    ctaStyle: clampCtaStyle(CTA_STYLE_BY_URGENCY[brandPlan.ctaStrategy.urgency], artDirection),
    colorBalance: clampColorBalance(brandPlan.visualDirection.paletteHint, artDirection),
  };

  // 写真が無い場合、split/overlap/full-bleedのような写真前提の構図は成立しないため、
  // タイポグラフィのみで組む構図へ必ず落とす（写真0枚で破綻させないため）。
  // HeroV2側はartDirectionごとに異なる「意図的なno-photo構成」を描き分ける。
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

/**
 * ヘッダー（スクロール前・Heroの上に重なっている間）を明背景/暗背景の
 * どちらの前提で描くかを決定論的に決める。Heroの実際のピクセルを解析することは
 * できないため、「そのartDirection×heroCompositionなら、Hero最上部は
 * 写真で覆われているか・paperBg等の明るい色面か」という構造的な事実から決める。
 *  - "light": Hero最上部が写真（暗さが不定）で覆われている想定 → 白文字を使う
 *  - "dark" : Hero最上部が明るい色面（paperBg等）の想定 → 濃色文字を使う
 * どちらの場合もHeaderV2側でさらに背景に半透明スクリムを敷き、写真の明暗に
 * 関わらずコントラストを確保する（テキスト色の分岐だけに頼らない）。
 */
export type HeaderTheme = "light" | "dark";

export function deriveHeaderTheme(artDirection: ArtDirection, composition: HeroComposition): HeaderTheme {
  if (composition === "full-bleed-center") return "light";
  if (composition === "overlap-editorial") return "dark";
  if (composition === "split-frame") return "dark";
  // typographic（写真0枚）: no-photo背景の明暗はartDirectionごとに固定なので、
  // その背景色に合わせる（sensory-immersiveだけ暗色背景）。
  return artDirection === "sensory-immersive" ? "light" : "dark";
}
