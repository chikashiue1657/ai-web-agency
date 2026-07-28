"use client";
import { useEffect, useState } from "react";
import type { CafeV2BlockId } from "@/lib/engine/section-plan-v2";
import type { HeaderTheme } from "@/lib/engine/v2-design-system";

const NAV_LABELS: Partial<Record<CafeV2BlockId, string>> = {
  signature: "看板商品",
  photoStory: "フォト",
  story: "ストーリー",
  menu: "メニュー",
  trust: "評判",
  accessHours: "アクセス",
};

const BLOCK_HREF: Partial<Record<CafeV2BlockId, string>> = {
  signature: "#signature",
  photoStory: "#photo-story",
  story: "#story",
  menu: "#menu",
  trust: "#trust",
  accessHours: "#access",
};

/**
 * v1のHeaderはナビ項目がv1のセクションid固定（#about等）だったが、
 * v2はデータ量に応じてセクション自体が出たり出なかったりするため、
 * 実際に表示されているブロックからナビを組み立てる（存在しないidへの
 * リンク切れを防ぐ）。
 *
 * `theme`はHero最上部が写真主体("light"=白文字前提)か明るい色面主体
 * ("dark"=濃色文字前提)かを`deriveHeaderTheme`(artDirection×heroComposition)
 * から決定論的に受け取る。以前は常に透明+白文字で固定していたため、
 * paperBgのような明るい背景の上でも白文字のまま埋没する不具合があった。
 *
 * どちらのthemeでも、スクロール前から完全な透明にはせず半透明スクリム
 * （light: 濃色70%、dark: 白70%）を敷く。写真の明暗は実際には分からない
 * ため、文字色の分岐だけに頼らずスクリムでコントラストを底上げする
 * （WCAG AA相当の4.5:1をどちらのthemeでも確保できる不透明度を検証済み）。
 * スクロール後は両themeとも同じ不透明な白背景+濃色文字へ統一する
 * （Hero通過後は常にpaperBg相当の明るいセクションが続くため）。
 */
export function HeaderV2({
  storeName,
  blocks,
  theme,
}: {
  storeName: string;
  blocks: CafeV2BlockId[];
  theme: HeaderTheme;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const thresholdPx = () => Math.max(window.innerHeight * 0.75, 320);
    const onScroll = () => setScrolled(window.scrollY > thresholdPx());
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = blocks
    .filter((b): b is keyof typeof NAV_LABELS => b in NAV_LABELS)
    .map((b) => ({ href: BLOCK_HREF[b]!, label: NAV_LABELS[b]! }));

  const isLight = theme === "light";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-stone-200 bg-white/95 backdrop-blur"
          : isLight
            ? "border-white/10 bg-stone-950/70 backdrop-blur-sm"
            : "border-black/5 bg-white/70 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-10 lg:px-16">
        <a
          href="#top"
          className={`text-sm font-semibold tracking-wide sm:text-base ${
            scrolled ? "text-stone-900" : isLight ? "text-white" : "text-stone-900"
          }`}
        >
          {storeName}
        </a>

        <nav className="hidden md:flex md:items-center md:gap-7">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-xs font-medium transition ${
                scrolled
                  ? "text-stone-600 hover:text-stone-900"
                  : isLight
                    ? "text-white/90 hover:text-white"
                    : "text-stone-700 hover:text-stone-900"
              }`}
            >
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
              scrolled
                ? "border-stone-300 text-stone-900 hover:bg-stone-100"
                : isLight
                  ? "border-white/50 text-white hover:bg-white/10"
                  : "border-stone-400 text-stone-900 hover:bg-black/5"
            }`}
          >
            ご予約
          </a>
        </nav>

        <button
          type="button"
          aria-label="メニューを開く"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-9 w-9 items-center justify-center rounded-full border md:hidden ${
            scrolled
              ? "border-stone-300 text-stone-900"
              : isLight
                ? "border-white/50 text-white"
                : "border-stone-400 text-stone-900"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-stone-200 bg-white px-5 py-3 md:hidden">
          <ul className="flex flex-col gap-1">
            {[...navItems, { href: "#contact", label: "ご予約" }].map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
