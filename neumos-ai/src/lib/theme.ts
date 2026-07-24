/**
 * 業種別デザインテーマ。
 *
 * 以前は全店舗が同じ配色（brand=紫）・同じ余白・同じカード意匠だったため、
 * どの業種のサイトも似た見た目になっていた。業種ごとに配色・余白・フォントの
 * 太さ/字間・カード意匠・Hero/CTAの雰囲気を変え、営業時に「その店らしい」
 * 見た目に見えるようにする。
 *
 * WebsiteRendererが一度だけ`resolveTheme`し、各セクションコンポーネントへ
 * `theme` propとして渡す（Server Componentのままで完結させるため、
 * React Contextではなくpropで受け渡す設計にしている）。
 *
 * Tailwindの静的解析に乗せるため、クラス名は必ずこのファイル内に
 * リテラル文字列として書く（動的な文字列結合はしない）。
 */
import { classifyIndustry, type IndustryCategory } from "@/lib/engine/industry";

export interface WebsiteTheme {
  /** Hero・CTAの背景グラデーション */
  heroGradient: string;
  ctaGradient: string;
  /** セクション見出し上の小さいラベル（About/Service等）・強調テキスト */
  accentText: string;
  /** カードの縁取り・背景 */
  cardBg: string;
  cardBorder: string;
  /** 交互セクションの背景（Service/Gallery/Access等） */
  altSectionBg: string;
  /** セクションの上下余白（業種の雰囲気に合わせて詰める/広げる） */
  sectionPadding: string;
  /** カード・ボタンの角丸の強さ */
  radius: string;
  /** 見出しフォントの太さ・字間 */
  headingFont: string;
  /** ギャラリーのプレースホルダー用グラデーション（テーマの配色に揃える） */
  galleryGradients: string[];
  /** Featureカードの装飾番号（薄い色）の文字色 */
  numberAccent: string;
  /**
   * ナビゲーションのホバー時スタイル。`hover:` 等の修飾子はTailwindの静的解析対象と
   * するため、必ずここに合成済みのクラス名をリテラルで持つ
   * （実行時に `hover:${accentText}` のように文字列結合すると、Tailwindのスキャナが
   * そのクラスを検出できずCSSが生成されない）。
   */
  navHoverText: string;
  navHoverBg: string;
}

const THEMES: Record<IndustryCategory, WebsiteTheme> = {
  cafe: {
    heroGradient: "bg-gradient-to-br from-amber-700 via-amber-600 to-orange-500",
    ctaGradient: "bg-gradient-to-br from-amber-700 to-orange-500",
    accentText: "text-amber-700",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-100",
    altSectionBg: "bg-orange-50/60",
    sectionPadding: "py-16 sm:py-24",
    radius: "rounded-3xl",
    headingFont: "font-bold tracking-tight",
    galleryGradients: [
      "from-amber-500 to-orange-700",
      "from-orange-500 to-amber-700",
      "from-yellow-500 to-amber-600",
    ],
    numberAccent: "text-amber-200",
    navHoverText: "hover:text-amber-700",
    navHoverBg: "hover:bg-amber-50",
  },
  hair_salon: {
    heroGradient: "bg-gradient-to-br from-rose-700 via-rose-600 to-pink-500",
    ctaGradient: "bg-gradient-to-br from-rose-700 to-pink-500",
    accentText: "text-rose-700",
    cardBg: "bg-rose-50",
    cardBorder: "border-rose-100",
    altSectionBg: "bg-pink-50/60",
    sectionPadding: "py-20 sm:py-28",
    radius: "rounded-2xl",
    headingFont: "font-light tracking-wide",
    galleryGradients: [
      "from-rose-400 to-pink-600",
      "from-pink-400 to-rose-600",
      "from-fuchsia-400 to-rose-500",
    ],
    numberAccent: "text-rose-200",
    navHoverText: "hover:text-rose-700",
    navHoverBg: "hover:bg-rose-50",
  },
  spa: {
    heroGradient: "bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500",
    ctaGradient: "bg-gradient-to-br from-teal-700 to-emerald-500",
    accentText: "text-teal-700",
    cardBg: "bg-teal-50",
    cardBorder: "border-teal-100",
    altSectionBg: "bg-emerald-50/60",
    sectionPadding: "py-20 sm:py-28",
    radius: "rounded-2xl",
    headingFont: "font-semibold tracking-normal",
    galleryGradients: [
      "from-teal-500 to-emerald-700",
      "from-emerald-500 to-teal-700",
      "from-cyan-500 to-teal-600",
    ],
    numberAccent: "text-teal-200",
    navHoverText: "hover:text-teal-700",
    navHoverBg: "hover:bg-teal-50",
  },
  izakaya: {
    heroGradient: "bg-gradient-to-br from-red-800 via-red-700 to-orange-600",
    ctaGradient: "bg-gradient-to-br from-red-800 to-orange-600",
    accentText: "text-red-700",
    cardBg: "bg-red-50",
    cardBorder: "border-red-100",
    altSectionBg: "bg-orange-50/60",
    sectionPadding: "py-12 sm:py-20",
    radius: "rounded-lg",
    headingFont: "font-extrabold tracking-tight",
    galleryGradients: [
      "from-red-600 to-orange-700",
      "from-orange-600 to-red-700",
      "from-amber-600 to-red-700",
    ],
    numberAccent: "text-red-200",
    navHoverText: "hover:text-red-700",
    navHoverBg: "hover:bg-red-50",
  },
  hotel: {
    heroGradient: "bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-700",
    ctaGradient: "bg-gradient-to-br from-slate-800 to-indigo-900",
    accentText: "text-indigo-800",
    cardBg: "bg-slate-50",
    cardBorder: "border-slate-200",
    altSectionBg: "bg-slate-50",
    sectionPadding: "py-20 sm:py-32",
    radius: "rounded-none",
    headingFont: "font-serif tracking-wide",
    galleryGradients: [
      "from-slate-600 to-indigo-800",
      "from-indigo-700 to-slate-800",
      "from-slate-500 to-slate-800",
    ],
    numberAccent: "text-indigo-200",
    navHoverText: "hover:text-indigo-800",
    navHoverBg: "hover:bg-slate-100",
  },
  general: {
    heroGradient: "bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500",
    ctaGradient: "bg-gradient-to-br from-brand-700 to-brand-500",
    accentText: "text-brand-600",
    cardBg: "bg-white",
    cardBorder: "border-gray-100",
    altSectionBg: "bg-gray-50",
    sectionPadding: "py-16 sm:py-24",
    radius: "rounded-2xl",
    headingFont: "font-bold tracking-tight",
    galleryGradients: [
      "from-brand-500 to-purple-700",
      "from-fuchsia-500 to-brand-700",
      "from-indigo-500 to-brand-600",
    ],
    numberAccent: "text-brand-100",
    navHoverText: "hover:text-brand-700",
    navHoverBg: "hover:bg-brand-50",
  },
};

export function resolveTheme(industry: string): WebsiteTheme {
  return THEMES[classifyIndustry(industry)];
}
