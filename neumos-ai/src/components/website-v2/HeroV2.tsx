import type { CafeThemeV2 } from "@/lib/theme-v2";
import { ParallaxImageV2 } from "./ParallaxImageV2";

/**
 * 没入型Hero。写真がある場合はフルブリードの背景写真（微細なパララックス付き）＋
 * 下部を暗くするグラデーション、無い場合は色面と大型タイポグラフィだけで
 * 空気感を出す（プレースホルダー画像は使わない）。
 * 「制作会社側の説明」は一切書かず、店の空気感・見出しコピー・単一のCTAのみを見せる。
 */
export function HeroV2({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
}: {
  storeName: string;
  heroTitle: string;
  heroSubtitle: string;
  area: string;
  industry: string;
  photoUrl?: string;
  ctaLabel: string;
  ctaHref: string;
  theme: CafeThemeV2;
}) {
  return (
    <section id="top" className="relative h-[92vh] min-h-[600px] w-full overflow-hidden sm:h-screen">
      {photoUrl ? (
        <>
          <ParallaxImageV2 src={photoUrl} alt={`${storeName}の店内の様子`} />
          <div className={`absolute inset-0 ${theme.heroOverlay}`} />
        </>
      ) : (
        <div className={`absolute inset-0 ${theme.heroNoPhotoBg}`}>
          <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-amber-100/5 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-1/4 h-96 w-96 rounded-full bg-amber-100/5 blur-3xl" />
        </div>
      )}

      <div className="relative flex h-full w-full flex-col justify-end px-5 pb-14 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <span
          className={`mb-4 inline-flex w-fit items-center rounded-full border border-white/25 px-3.5 py-1 text-[11px] font-medium tracking-wide text-white/90 sm:text-xs`}
        >
          {area} ・ {industry}
        </span>

        {/*
          スマホは幅を絞って短い行で改行させ、PCは幅を広げて大きいフォントのまま
          自然な位置で改行させる、と breakpoint ごとに異なる改行制御にしている
          （文字列を手動分割すると任意の店名・コピーで破綻するため、幅とサイズで制御する）。
          break-keep（キリの良い単位で改行）を優先しつつ、モバイルの狭い幅では
          「毎日通いたくなる」のようなCJKの連続だけでも1行に収まらないことがあり、
          break-wordsを最終手段として折り返す（さもないと画面幅をはみ出す実バグがあった）。
          ただしbreak-wordsは常時有効だと「BB‑Coffee」のような非分割ハイフン付き
          店名の途中でも改行してしまう（sm以上の広い幅ではCJKとラテン文字の
          境界で折り返すだけで十分収まるため、店名を割ってまで詰め込む必要が無い）。
          そのためsm以上ではoverflow-wrap:normalに戻し、店名を1単位として扱う。
        */}
        <h1
          className={`max-w-[13ch] break-keep break-words text-4xl leading-[1.15] text-white [text-wrap:balance] sm:max-w-2xl sm:[overflow-wrap:normal] sm:text-6xl sm:leading-[1.05] lg:text-7xl ${theme.displayFont} ${photoUrl ? "" : theme.heroNoPhotoText}`}
        >
          {heroTitle}
        </h1>
        <p className="mt-5 max-w-[26ch] break-keep break-words text-sm leading-relaxed text-white/85 sm:max-w-md sm:text-base sm:[overflow-wrap:normal]">
          {heroSubtitle}
        </p>

        {/* Heroの行動喚起はここ1箇所のみ（ページ末尾のCTAセクションとは別の、最初の入口）。 */}
        <a
          href={ctaHref}
          className="mt-8 inline-flex w-fit items-center gap-2 border-b border-white/70 pb-1 text-sm font-medium text-white transition hover:gap-3 hover:border-white sm:text-base"
        >
          {ctaLabel}
          <span aria-hidden>→</span>
        </a>
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
