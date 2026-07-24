"use client";
import { useEffect, useState } from "react";
import type { CafeV2BlockId } from "@/lib/engine/section-plan-v2";

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
 * Hero上では写真に重ねる透明・白文字だが、そのままsticky固定すると
 * Hero通過後（明るい背景のStory等）で白文字が読めなくなる。
 * スクロール量に応じて背景・文字色を切り替える（装飾ではなく可読性のための制御）。
 */
export function HeaderV2({ storeName, blocks }: { storeName: string; blocks: CafeV2BlockId[] }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const threshold = () => Math.max(window.innerHeight * 0.75, 320);
    const onScroll = () => setScrolled(window.scrollY > threshold());
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = blocks
    .filter((b): b is keyof typeof NAV_LABELS => b in NAV_LABELS)
    .map((b) => ({ href: BLOCK_HREF[b]!, label: NAV_LABELS[b]! }));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-stone-200 bg-white/95 backdrop-blur" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-10 lg:px-16">
        <a
          href="#top"
          className={`text-sm font-semibold tracking-wide sm:text-base ${scrolled ? "text-stone-900" : "text-white drop-shadow"}`}
        >
          {storeName}
        </a>

        <nav className="hidden md:flex md:items-center md:gap-7">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-xs font-medium transition ${
                scrolled ? "text-stone-600 hover:text-stone-900" : "text-white/85 drop-shadow hover:text-white"
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
                : "border-white/40 text-white hover:bg-white/10"
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
            scrolled ? "border-stone-300 text-stone-900" : "border-white/40 text-white"
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
