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
  /** Hero写真の上に重ねる暗幕グラデーション（下部を濃く、見出しの可読性を確保） */
  heroOverlay: string;
  /** 写真が0枚のときのHero背景（プレースホルダー画像ではなく色面+タイポで見せる） */
  heroNoPhotoBg: string;
  heroNoPhotoText: string;
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
  heroOverlay: "bg-gradient-to-t from-stone-950/90 via-stone-950/25 to-stone-950/5",
  heroNoPhotoBg: "bg-gradient-to-br from-stone-950 via-amber-950 to-stone-900",
  heroNoPhotoText: "text-amber-100",
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

export function resolveCafeThemeV2(): CafeThemeV2 {
  return CAFE_THEME_V2;
}
