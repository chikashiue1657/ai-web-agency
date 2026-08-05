import { describe, expect, it } from "vitest";
import { PALETTE_TOKENS } from "@/lib/theme-v2";

/**
 * `PALETTE_TOKENS`内で実際に使っているTailwindクラス名(既定パレット)を
 * 対応する16進カラーへ変換するための最小限の対応表。
 * `tailwind.config.ts`はデフォルトカラーパレットに独自の"brand"を追加している
 * だけで、stone/amber/neutral/slate/sky/black/whiteはTailwind v3の既定値の
 * ままであることを確認済み。ここではコントラスト比のテストに必要な
 * クラスだけを列挙する（汎用的なTailwind全カラー辞書は持たない）。
 */
const TAILWIND_HEX: Record<string, string> = {
  "text-white": "#ffffff",
  "bg-white": "#ffffff",
  "text-black": "#000000",
  "bg-black": "#000000",
  "text-amber-900": "#78350f",
  "text-amber-800": "#92400e",
  "bg-stone-900": "#1c1917",
  "text-stone-800": "#292524",
  "text-stone-600": "#57534e",
  "bg-stone-50": "#fafaf9",
  "text-neutral-900": "#171717",
  "text-neutral-800": "#262626",
  "text-neutral-700": "#404040",
  "text-neutral-600": "#525252",
  "bg-neutral-900": "#171717",
  "bg-neutral-50": "#fafafa",
  "text-sky-900": "#0c4a6e",
  "text-sky-800": "#075985",
  "text-slate-800": "#1e293b",
  "text-slate-600": "#475569",
  "bg-slate-900": "#0f172a",
  "bg-slate-50": "#f8fafc",
};

function resolveHex(className: string): string {
  const hex = TAILWIND_HEX[className];
  if (!hex) throw new Error(`テスト用の色対応表に無いクラス: ${className}（TAILWIND_HEXへ追加してください）`);
  return hex;
}

/** WCAG 2.x の相対輝度計算。 */
function relativeLuminance(hex: string): number {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x のコントラスト比（1〜21）。 */
function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const WCAG_AA_NORMAL_TEXT = 4.5;

describe("PALETTE_TOKENS: 4パレットの機械的な差別化", () => {
  const paletteNames = Object.keys(PALETTE_TOKENS) as Array<keyof typeof PALETTE_TOKENS>;
  const tokenKeys = [
    "darkSectionBg",
    "darkSectionText",
    "accentText",
    "accentTextSoft",
    "paperBg",
    "paperRaisedBg",
    "bodyText",
    "bodyTextSoft",
    "ctaBg",
    "ctaText",
    "borderSoft",
    "photoOverlay",
  ] as const;

  it("必須トークンがすべてのパレットで定義されている", () => {
    for (const name of paletteNames) {
      for (const key of tokenKeys) {
        expect(PALETTE_TOKENS[name][key]).toBeTruthy();
      }
    }
  });

  it("4パレットが同一トークンセットになっていない(warmとneutralが以前は同一だった不具合の再発防止)", () => {
    const [first, ...rest] = paletteNames;
    for (const other of rest) {
      const differentKeys = tokenKeys.filter((key) => PALETTE_TOKENS[first][key] !== PALETTE_TOKENS[other][key]);
      // 少なくとも過半数のトークンが異なることを要求する(背景色だけの差ではないことの担保)。
      expect(differentKeys.length).toBeGreaterThanOrEqual(Math.ceil(tokenKeys.length / 2));
    }
  });

  it("warm と neutral は同一クラスにならない(直接の回帰テスト)", () => {
    expect(PALETTE_TOKENS.warm.accentText).not.toBe(PALETTE_TOKENS.neutral.accentText);
    expect(PALETTE_TOKENS.warm.darkSectionBg).not.toBe(PALETTE_TOKENS.neutral.darkSectionBg);
    expect(PALETTE_TOKENS.warm.ctaBg).not.toBe(PALETTE_TOKENS.neutral.ctaBg);
    expect(PALETTE_TOKENS.warm.photoOverlay).not.toBe(PALETTE_TOKENS.neutral.photoOverlay);
  });

  it.each(paletteNames)("%s: 本文色(bodyText)と背景(paperBg)のコントラストがWCAG AA(4.5:1)以上", (name) => {
    const palette = PALETTE_TOKENS[name];
    const ratio = contrastRatio(resolveHex(palette.bodyText), resolveHex(palette.paperBg));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it.each(paletteNames)("%s: 控えめな本文色(bodyTextSoft)と背景(paperBg)のコントラストがWCAG AA以上", (name) => {
    const palette = PALETTE_TOKENS[name];
    const ratio = contrastRatio(resolveHex(palette.bodyTextSoft), resolveHex(palette.paperBg));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it.each(paletteNames)("%s: アクセント色(accentText)と背景(paperRaisedBg)のコントラストがWCAG AA以上", (name) => {
    const palette = PALETTE_TOKENS[name];
    const ratio = contrastRatio(resolveHex(palette.accentText), resolveHex(palette.paperRaisedBg));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it.each(paletteNames)("%s: CTA文字(ctaText)とCTA背景(ctaBg)のコントラストがWCAG AA以上", (name) => {
    const palette = PALETTE_TOKENS[name];
    const ratio = contrastRatio(resolveHex(palette.ctaText), resolveHex(palette.ctaBg));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it.each(paletteNames)("%s: 濃色セクション文字(darkSectionText)とdarkSectionBgの主要色が十分に明暗差を持つ", (name) => {
    // darkSectionBgはグラデーション文字列（クラス名合成）のため単一hexに変換できない。
    // 代わりに、グラデーションの端点として使われている色調が「濃色」であることを
    // クラス名から確認する（950/900/black系であること）。
    const palette = PALETTE_TOKENS[name];
    expect(palette.darkSectionBg).toMatch(/-950|-900|black/);
    expect(palette.darkSectionText).toMatch(/-100|white/);
  });
});
