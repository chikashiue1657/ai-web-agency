/**
 * カフェv2専用のデザイントークン。
 *
 * v1の`theme.ts`（5業種共通の1トークン体系）とは別に定義する。カフェv2は
 * 「カード＋均一余白」の型を崩す前提のため、v1トークン（cardBg/cardBorder/
 * sectionPadding等、カード前提の語彙）をそのまま流用すると設計思想が
 * v1に引っ張られてしまう。将来他業種へ拡張する際は、このファイルへ
 * 業種ごとのトークンを追加していく（v1のTHEMES/resolveThemeと同じ形）。
 *
 * Tailwindの静的解析に乗せるため、クラス名は必ずこのファイル内に
 * リテラル文字列として書く（動的な文字列結合はしない）。
 *
 * パレット（warm/neutral/cool/high-contrast）は、以前は"warm"を基準に
 * 一部トークン（accentText/accentTextSoft/ctaBg）だけを差分上書きする方式
 * だったため、"warm"と"neutral"が実質同一のCSSになってしまっていた
 * （neutralは上書き対象が無く、常にwarmの値へフォールバックしていた）。
 * ここでは4パレットをそれぞれ完全に独立したトークンセットとして定義し、
 * 背景・本文色・控えめな本文色・アクセント・罫線・CTA背景・CTA文字・
 * 写真オーバーレイ・表面色のすべてに一貫した差を持たせる。
 * 彩度は抑え、店舗サイトとしての高級感を壊さない範囲に留めた
 * （`tests/theme-v2-contrast.test.ts`で主要な文字色×背景色の組み合わせが
 * WCAG AA(4.5:1)を満たすことを検証している）。
 */
export interface CafeThemeV2 {
  /** 濃色の帯として使うセクション背景（Trustの信頼要素セクション等）。 */
  darkSectionBg: string;
  darkSectionText: string;
  accentText: string;
  accentTextSoft: string;
  paperBg: string;
  paperRaisedBg: string;
  /** 見出し用フォント。店名・商品名の主張を強くするためセリフ体を使う。 */
  displayFont: string;
  bodyText: string;
  bodyTextSoft: string;
  ctaBg: string;
  /** ctaBgの上に乗る文字色。以前は各コンポーネントが`text-white`を決め打ちしていた。 */
  ctaText: string;
  /** カード・区切り線に使う、パレット由来の控えめな罫線色。 */
  borderSoft: string;
  /** Hero/Story写真の上に敷く薄いスクリム・写真クレジット背景の色調。 */
  photoOverlay: string;
}

type PaletteHint = "warm" | "cool" | "neutral" | "high-contrast";
type TypographyTone = "editorial-serif" | "clean-sans" | "bold-display";

/**
 * "warm"（既定・以前からの見た目と同一値）: アンバー×ストーンの温かい配色。
 * accentText/accentTextSoftはamber-900/800（axe-coreのcolor-contrastスキャンで
 * 白地4.5:1以上を確認済みの値。以前amber-700/90で不足していた実不具合の修正値）。
 */
const WARM_THEME: CafeThemeV2 = {
  darkSectionBg: "bg-gradient-to-br from-stone-950 via-amber-950 to-stone-900",
  darkSectionText: "text-amber-100",
  accentText: "text-amber-900",
  accentTextSoft: "text-amber-800",
  paperBg: "bg-stone-50",
  paperRaisedBg: "bg-white",
  displayFont: "font-serif tracking-tight",
  bodyText: "text-stone-800",
  bodyTextSoft: "text-stone-600",
  ctaBg: "bg-stone-900",
  ctaText: "text-white",
  borderSoft: "border-amber-200",
  photoOverlay: "bg-stone-950/60",
};

/** "neutral": 彩色を持たない真のグレースケール。warmとは色相そのものが異なる。 */
const NEUTRAL_THEME: CafeThemeV2 = {
  darkSectionBg: "bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-800",
  darkSectionText: "text-neutral-100",
  accentText: "text-neutral-900",
  accentTextSoft: "text-neutral-600",
  paperBg: "bg-neutral-50",
  paperRaisedBg: "bg-white",
  displayFont: "font-serif tracking-tight",
  bodyText: "text-neutral-800",
  bodyTextSoft: "text-neutral-600",
  ctaBg: "bg-neutral-900",
  ctaText: "text-white",
  borderSoft: "border-neutral-300",
  photoOverlay: "bg-neutral-950/65",
};

/** "cool": スレート×スカイの落ち着いた寒色。都会的・洗練された方向に振る。 */
const COOL_THEME: CafeThemeV2 = {
  darkSectionBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800",
  darkSectionText: "text-sky-100",
  accentText: "text-sky-900",
  accentTextSoft: "text-sky-800",
  paperBg: "bg-slate-50",
  paperRaisedBg: "bg-white",
  displayFont: "font-serif tracking-tight",
  bodyText: "text-slate-800",
  bodyTextSoft: "text-slate-600",
  ctaBg: "bg-slate-900",
  ctaText: "text-white",
  borderSoft: "border-slate-300",
  photoOverlay: "bg-slate-950/65",
};

/** "high-contrast": ほぼ黒白のみ。彩度を持たせずグラフィカルな強さを出す方向。 */
const HIGH_CONTRAST_THEME: CafeThemeV2 = {
  darkSectionBg: "bg-black",
  darkSectionText: "text-white",
  accentText: "text-black",
  accentTextSoft: "text-neutral-700",
  paperBg: "bg-white",
  paperRaisedBg: "bg-white",
  displayFont: "font-serif tracking-tight",
  bodyText: "text-black",
  bodyTextSoft: "text-neutral-700",
  ctaBg: "bg-black",
  ctaText: "text-white",
  borderSoft: "border-black",
  photoOverlay: "bg-black/70",
};

/** paletteHintごとの完全なトークンセット。4値はそれぞれ独立して定義してあり、差分上書きは行わない。 */
export const PALETTE_TOKENS: Record<PaletteHint, CafeThemeV2> = {
  warm: WARM_THEME,
  neutral: NEUTRAL_THEME,
  cool: COOL_THEME,
  "high-contrast": HIGH_CONTRAST_THEME,
};

/** 後方互換用のエイリアス（既定パレット="warm"）。 */
export const CAFE_THEME_V2: CafeThemeV2 = WARM_THEME;

const TYPOGRAPHY_OVERRIDES: Partial<Record<TypographyTone, Partial<CafeThemeV2>>> = {
  "clean-sans": { displayFont: "font-sans tracking-tight" },
  "bold-display": { displayFont: "font-sans font-bold tracking-tight" },
};

/**
 * Brand Director接続用のパレット・書体解決。`paletteHint`未指定時は"warm"
 * （既存の見た目）を返す。書体(`typographyTone`)は色とは独立した軸のため、
 * パレット確定後に別途上書きする。
 */
export function resolveCafeThemeV2(paletteHint?: PaletteHint, typographyTone?: TypographyTone): CafeThemeV2 {
  const base = PALETTE_TOKENS[paletteHint ?? "warm"];
  return {
    ...base,
    ...(typographyTone ? TYPOGRAPHY_OVERRIDES[typographyTone] : undefined),
  };
}
