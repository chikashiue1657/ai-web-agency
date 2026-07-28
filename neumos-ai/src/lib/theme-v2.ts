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
}

export const CAFE_THEME_V2: CafeThemeV2 = {
  darkSectionBg: "bg-gradient-to-br from-stone-950 via-amber-950 to-stone-900",
  darkSectionText: "text-amber-100",
  // amber-700/90（白地でコントラスト比約3.9:1）はWCAG AAの4.5:1未達だったため、
  // axe-coreのcolor-contrastスキャンで検出された実不具合として、白地で
  // 4.5:1以上を確保できる濃さ（不透明・amber-900/800）に変更した。
  accentText: "text-amber-900",
  accentTextSoft: "text-amber-800",
  paperBg: "bg-stone-50",
  paperRaisedBg: "bg-white",
  displayFont: "font-serif tracking-tight",
  bodyText: "text-stone-800",
  bodyTextSoft: "text-stone-600",
  ctaBg: "bg-stone-900",
};

/**
 * Brand Director接続用の任意上書き（PaletteHint/TypographyTone）。
 * 引数を渡さない既存の呼び出しは`CAFE_THEME_V2`と値が完全に一致するオブジェクトを
 * 返すため、既存の見た目には一切影響しない。
 *
 * "warm"（現行の既定色味）・"neutral"（rule-providerの既定値）・
 * "editorial-serif"（現行の既定書体）は上書き対象が無いため、そのまま
 * CAFE_THEME_V2の値を使う。他の値のみ、axe-coreで確認済みの既定と同等以上の
 * コントラスト（いずれも900番台・黒）を確保した値へ上書きする。
 */
type PaletteHint = "warm" | "cool" | "neutral" | "high-contrast";
type TypographyTone = "editorial-serif" | "clean-sans" | "bold-display";

const PALETTE_OVERRIDES: Partial<Record<PaletteHint, Partial<CafeThemeV2>>> = {
  cool: {
    accentText: "text-sky-900",
    accentTextSoft: "text-sky-800",
    ctaBg: "bg-slate-900",
  },
  "high-contrast": {
    accentText: "text-black",
    accentTextSoft: "text-stone-900",
    ctaBg: "bg-black",
  },
};

const TYPOGRAPHY_OVERRIDES: Partial<Record<TypographyTone, Partial<CafeThemeV2>>> = {
  "clean-sans": { displayFont: "font-sans tracking-tight" },
  "bold-display": { displayFont: "font-sans font-bold tracking-tight" },
};

export function resolveCafeThemeV2(paletteHint?: PaletteHint, typographyTone?: TypographyTone): CafeThemeV2 {
  return {
    ...CAFE_THEME_V2,
    ...(paletteHint ? PALETTE_OVERRIDES[paletteHint] : undefined),
    ...(typographyTone ? TYPOGRAPHY_OVERRIDES[typographyTone] : undefined),
  };
}
