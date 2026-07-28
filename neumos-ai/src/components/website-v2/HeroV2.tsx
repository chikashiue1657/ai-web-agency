"use client";
import { useState } from "react";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, HeroComposition } from "@/lib/engine/v2-design-system";
import { ParallaxImageV2 } from "./ParallaxImageV2";

interface HeroV2Props {
  storeName: string;
  heroTitle: string;
  heroSubtitle: string;
  area: string;
  industry: string;
  photoUrl?: string;
  ctaLabel: string;
  ctaHref: string;
  theme: CafeThemeV2;
  /** BrandPlan由来の構図(写真0枚なら呼び出し側が"typographic"を渡す)。 */
  composition: HeroComposition;
  /** typographyScaleに応じた見出しサイズ(resolveTypographyClasses(...).heroTitle)。 */
  heroTitleClass: string;
  /** 写真0枚時のno-photo構成をどの方向で組むかを決める。 */
  artDirection: ArtDirection;
}

/**
 * heroTitle文字列からstoreNameの箇所を見つけ、別スタイルで独立させて
 * 表示するための分割。`heroTitle`は"毎日通いたくなる{storeName}"のように
 * 生成エンジン側でstoreNameを地の文へ直接連結した1本の文字列であり
 * （v1と共有するコピー生成ロジックのため、この結合自体は変更しない）、
 * そのまま1つの見出しサイズで描画すると、英字・ハイフン入りの店名が
 * 日本語の文と同じ巨大さになり、狭い画面で不自然に折り返る。
 * storeNameが文字列中に見つかった場合だけ前後を分割し、storeName部分は
 * 別コンポーネント（HeroTitle）で相対的に小さい独立したスタイルを当てる。
 * 見つからない場合（他業種のコピーパターン・truncateによる欠落等）は
 * 分割せずheroTitleをそのまま1つのブロックとして描画する（無理に分割しない）。
 */
function splitHeroTitle(
  heroTitle: string,
  storeName: string
): { before: string; name: string | null; after: string } {
  if (!storeName) return { before: heroTitle, name: null, after: "" };
  const idx = heroTitle.indexOf(storeName);
  if (idx === -1) return { before: heroTitle, name: null, after: "" };
  return { before: heroTitle.slice(0, idx), name: storeName, after: heroTitle.slice(idx + storeName.length) };
}

/**
 * Hero見出し。英単語・ハイフン入り店名が途中で破壊されないよう、
 * `[overflow-wrap:normal]`（欧文は単語境界・ハイフンでしか折り返さない）を
 * 全構図・全breakpointで統一して使う（以前は`break-words`と併用しており、
 * コンテナに収まらない場合に英単語の途中で強制的に折り返すことがあった
 * ＝実際に発生した不具合）。
 * `word-break: keep-all`（`break-keep`）は意図的に付けない。keep-allは
 * 「CJK文字どうしの間の改行を禁止する」プロパティであり、スペースを含まない
 * 日本語の見出し文（例:「毎日通いたくなる」）に適用すると改行位置が
 * 一切無くなり、見出し全体がコンテナ幅を超えて隣接する写真へめり込む
 * ／隠れるという不具合を実際に引き起こした。デフォルトの`word-break:normal`
 * はCJK文字間の改行を許可しつつ、`overflow-wrap:normal`と組み合わせれば
 * 欧文単語だけは単語境界・ハイフン以外で折り返さないため、これで両立できる。
 * storeNameが検出できた場合は`text-[0.5em]`の相対サイズでブランド名らしい
 * 独立した大きさへ縮小する（ナビの店名表示と過剰に重複しないよう、ここでは
 * 別要素を新設せず、既存のheroTitle内で視覚的階層だけを分ける）。
 */
function HeroTitle({
  heroTitle,
  storeName,
  heroTitleClass,
  className = "",
}: {
  heroTitle: string;
  storeName: string;
  heroTitleClass: string;
  className?: string;
}) {
  const { before, name, after } = splitHeroTitle(heroTitle, storeName);
  return (
    <h1
      className={`max-w-[16ch] [overflow-wrap:normal] [text-wrap:balance] ${heroTitleClass} ${className}`}
    >
      {before}
      {name && <span className="font-sans text-[0.5em] font-medium tracking-tight">{name}</span>}
      {after}
    </h1>
  );
}

/**
 * Hero（写真あり・全面/色面のいずれも白文字）の入口CTA。ページ末尾のCTAセクションとは別。
 * `scroll-mb-28`: キーボード操作でこのリンクへフォーカスが移った際、ブラウザが
 * 自動スクロールする位置がモバイル下部固定CTAバーの真下にならないための
 * 余白（sm以上は固定バー自体が無いため既定に戻す）。
 */
function HeroEntryLink({ ctaLabel, ctaHref }: { ctaLabel: string; ctaHref: string }) {
  return (
    <a
      href={ctaHref}
      className="mt-8 inline-flex w-fit scroll-mb-28 items-center gap-2 border-b border-white/70 pb-1 text-sm font-medium text-white transition hover:gap-3 hover:border-white sm:scroll-mb-0 sm:text-base"
    >
      {ctaLabel}
      <span aria-hidden>→</span>
    </a>
  );
}

/** 明るい背景（split-frame/overlap-editorial）用の入口CTA。 */
function HeroEntryLinkOnLight({
  ctaLabel,
  ctaHref,
  theme,
}: {
  ctaLabel: string;
  ctaHref: string;
  theme: CafeThemeV2;
}) {
  return (
    <a
      href={ctaHref}
      className={`mt-6 inline-flex w-fit items-center gap-2 border-b border-current pb-1 text-sm font-medium transition hover:gap-3 sm:mt-8 sm:text-base ${theme.accentText}`}
    >
      {ctaLabel}
      <span aria-hidden>→</span>
    </a>
  );
}

function EyebrowLabel({ area, industry, tone, theme }: { area: string; industry: string; tone: "light" | "dark"; theme: CafeThemeV2 }) {
  return (
    <span
      className={`mb-4 block w-fit text-[11px] font-medium tracking-wide sm:text-xs ${
        tone === "light" ? "text-white/80" : theme.accentText
      }`}
    >
      {area} ・ {industry}
    </span>
  );
}

/**
 * "full-bleed-center"（Sensory Immersive）: 写真を画面いっぱいに敷く、最も
 * 没入感の強い構図。以前は写真全面に暗いグラデーションを重ねていたが、これは
 * 「写真を暗いoverlayで覆い隠さない」方針に反するため撤廃した。
 * テキストは写真から独立した半透明の面（チップ）にだけ乗せ、写真自体は
 * ほぼそのまま見せる。チップは文字の分だけの大きさに留め、写真全体を
 * 覆う暗幕にはしない。
 *
 * モバイルとdesktop(sm:以上)で構造そのものを分ける:
 *  - desktop: 従来通りsectionをh-dvhにし、写真を絶対配置でフルブリード、
 *    テキストのチップを下部に重ねる。
 *  - mobile: h-dvhにしない。写真をaspect-[4/3]の通常フローブロックとして
 *    上に置き(object-cover。被写体は多少trimmされ得るが、h-dvhの縦長箱に
 *    object-containで収めた場合のような巨大なレターボックスは発生しない)、
 *    その直下に暗色のテキストパネルを続ける縦積み構成にする（実写真検証で、
 *    object-containがモバイルの縦長ビューポートで写真を中央の細い帯にし、
 *    上下に巨大な黒帯を作ってしまう不具合を確認したための変更）。
 *    写真ごとの被写体位置の推測(Vision等)は行わない。
 */
function FullBleedCenterHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  heroTitleClass,
  onHeroPhotoFail,
}: HeroV2Props & { photoUrl: string; onHeroPhotoFail: () => void }) {
  return (
    <section id="top" className="relative w-full overflow-hidden bg-stone-950 sm:h-dvh sm:min-h-[640px]">
      <div className="relative aspect-[4/3] w-full sm:absolute sm:inset-0 sm:aspect-auto sm:h-full">
        <ParallaxImageV2 src={photoUrl} alt={`${storeName}の写真`} onFail={onHeroPhotoFail} />
      </div>

      {/*
        pb-28: モバイルの下部固定CTAバー(概ね64〜90px、safe-area込み)にHero自身の
        CTA・本文が隠れないための余白。sm以上は固定CTAバー自体が出ないため
        通常の余白に戻す。
      */}
      <div className="relative flex w-full flex-col bg-stone-950 px-5 pb-28 pt-8 sm:absolute sm:inset-0 sm:h-full sm:justify-end sm:bg-transparent sm:px-10 sm:pb-12 sm:pt-0 lg:px-16 lg:pb-16">
        <div className="sm:w-fit sm:max-w-[92vw] sm:rounded-sm sm:bg-stone-950/75 sm:px-8 sm:py-8 sm:backdrop-blur-sm sm:max-w-lg">
          <span className="mb-4 block w-fit text-[11px] font-medium tracking-wide text-white/80 sm:text-xs">
            {area} ・ {industry}
          </span>
          <HeroTitle heroTitle={heroTitle} storeName={storeName} heroTitleClass={heroTitleClass} className="text-white [text-wrap:balance]" />
          <p className="mt-5 max-w-[26ch] [overflow-wrap:normal] text-sm leading-relaxed text-white/85 sm:max-w-md sm:text-base">
            {heroSubtitle}
          </p>
          <HeroEntryLink ctaLabel={ctaLabel} ctaHref={ctaHref} />
        </div>
      </div>

      <div
        aria-hidden
        className="absolute bottom-5 right-5 hidden flex-col items-center gap-1 text-white/60 motion-safe:animate-pulse sm:flex"
      >
        <span className="h-8 w-px bg-white/40" />
      </div>
    </section>
  );
}

/**
 * "split-frame"（Japanese Editorial）: 写真を全面に敷かず、左右非対称の
 * 2分割にする。モバイルは写真（枠付き）を上、テキストパネルを下に積む。
 * テキストは常に写真の外側にあるため、overlayは一切不要。
 */
function SplitFrameHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
  onHeroPhotoFail,
}: HeroV2Props & { photoUrl: string; onHeroPhotoFail: () => void }) {
  return (
    <section id="top" className={`w-full ${theme.paperBg}`}>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,44%)_1fr]">
        <div className="order-2 flex flex-col justify-center px-5 py-14 sm:px-10 sm:py-20 lg:order-1 lg:px-16">
          <EyebrowLabel area={area} industry={industry} tone="dark" theme={theme} />
          <HeroTitle
            heroTitle={heroTitle}
            storeName={storeName}
            heroTitleClass={heroTitleClass}
            className={`max-w-[15ch] sm:max-w-lg ${theme.displayFont} ${theme.bodyText}`}
          />
          <p className={`mt-5 max-w-[34ch] [overflow-wrap:normal] text-sm leading-relaxed sm:max-w-sm sm:text-base ${theme.bodyTextSoft}`}>
            {heroSubtitle}
          </p>
          <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        </div>

        <div className="relative order-1 aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[560px]">
          <div className="absolute inset-3 overflow-hidden sm:inset-6 lg:inset-8">
            <ParallaxImageV2 src={photoUrl} alt={`${storeName}の写真`} onFail={onHeroPhotoFail} />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * "overlap-editorial"（Warm Craft）: 写真を余白付きで枠内に収め、テキスト
 * カードをその角へ重ねる、雑誌の特集扉のような構図。カードは常に通常
 * フロー内に置く（absolute+translateは使わない。カードの実際の高さは
 * コンテンツ量で変わるため、絶対配置＋固定スペーサーの組み合わせは高さの
 * 見積もりを誤ると後続セクションと視覚的に衝突する不具合が実際に発生した。
 * negative marginで写真に食い込ませる方式なら、後続の兄弟要素は常に
 * カードの実高さの分だけ正しく押し下げられる）。
 */
function OverlapEditorialHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  photoUrl,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
  onHeroPhotoFail,
}: HeroV2Props & { photoUrl: string; onHeroPhotoFail: () => void }) {
  return (
    <section id="top" className={`w-full ${theme.paperBg} px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-14 lg:px-12 lg:pb-20`}>
      <div className="relative mx-auto max-w-6xl">
        <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/9] lg:aspect-[21/9]">
          <ParallaxImageV2 src={photoUrl} alt={`${storeName}の写真`} onFail={onHeroPhotoFail} />
        </div>

        <div
          className={`relative z-10 mx-4 -mt-16 max-w-md ${theme.paperRaisedBg} px-6 py-8 shadow-sm sm:mx-10 sm:-mt-24 sm:px-10 sm:py-10 lg:mx-16 lg:-mt-28 lg:max-w-xl lg:px-12 lg:py-12`}
        >
          <EyebrowLabel area={area} industry={industry} tone="dark" theme={theme} />
          <HeroTitle
            heroTitle={heroTitle}
            storeName={storeName}
            heroTitleClass={heroTitleClass}
            className={`max-w-[14ch] ${theme.displayFont} ${theme.bodyText}`}
          />
          <p className={`mt-4 max-w-[30ch] [overflow-wrap:normal] text-sm leading-relaxed ${theme.bodyTextSoft}`}>
            {heroSubtitle}
          </p>
          <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        </div>
      </div>
    </section>
  );
}

type NoPhotoHeroProps = Omit<HeroV2Props, "photoUrl" | "composition">;

/**
 * 写真0枚・Japanese Editorial: 罫線・ノンブル・小さな英字ラベルで組む、
 * 雑誌の目次ページのような静かな構成。ぼかした色面（失敗した画像読み込みに
 * 見える）は使わない。
 */
function JapaneseEditorialTypographicHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: NoPhotoHeroProps) {
  return (
    <section id="top" className={`w-full ${theme.paperBg}`}>
      <div className="mx-auto flex min-h-[80dvh] max-w-5xl flex-col justify-center border-y border-stone-300 px-5 py-16 sm:min-h-[85dvh] sm:px-10 sm:py-24 lg:px-0">
        <p className="text-xs font-medium tracking-[0.3em] text-stone-500">
          {String(1).padStart(2, "0")} — {area} / {industry}
        </p>
        <HeroTitle
          heroTitle={heroTitle}
          storeName={storeName}
          heroTitleClass={heroTitleClass}
          className={`mt-8 max-w-[14ch] border-t border-stone-300 pt-8 ${theme.displayFont} ${theme.bodyText}`}
        />
        <p className={`mt-6 max-w-[38ch] [overflow-wrap:normal] text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
          {heroSubtitle}
        </p>
        <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        <p className="mt-16 text-xs tracking-[0.3em] text-stone-400">{storeName.toUpperCase()}</p>
      </div>
    </section>
  );
}

/**
 * 写真0枚・Sensory Immersive: 大型タイポグラフィと斜めのグラフィック要素で
 * エネルギーを出す。写真の代用に見えないよう、はっきり幾何学的な図形にする。
 */
function SensoryImmersiveTypographicHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: NoPhotoHeroProps) {
  return (
    <section id="top" className="relative flex min-h-[85dvh] w-full items-end overflow-hidden bg-stone-950 sm:min-h-[90dvh]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rotate-12 border border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 top-1/4 h-64 w-64 rotate-45 bg-white/5"
      />
      {/* pb-28: モバイル下部固定CTAバーにHero自身のCTA・本文が隠れないための余白。 */}
      <div className="relative flex w-full flex-col px-5 pb-28 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <EyebrowLabel area={area} industry={industry} tone="light" theme={theme} />
        <HeroTitle
          heroTitle={heroTitle}
          storeName={storeName}
          heroTitleClass={heroTitleClass}
          className="max-w-[13ch] text-white sm:max-w-2xl"
        />
        <p className="mt-5 max-w-[26ch] [overflow-wrap:normal] text-sm leading-relaxed text-white/85 sm:max-w-md sm:text-base">
          {heroSubtitle}
        </p>
        <HeroEntryLink ctaLabel={ctaLabel} ctaHref={ctaHref} />
        <p className="mt-10 text-xs uppercase tracking-[0.3em] text-white/40">{storeName}</p>
      </div>
    </section>
  );
}

/**
 * 写真0枚・Warm Craft: 紙・スタンプを思わせる控えめなCSS表現（回転した
 * 四角い枠・点線）で温かみを出す。画像アセットは使わない。
 */
function WarmCraftTypographicHero({
  storeName,
  heroTitle,
  heroSubtitle,
  area,
  industry,
  ctaLabel,
  ctaHref,
  theme,
  heroTitleClass,
}: NoPhotoHeroProps) {
  return (
    <section id="top" className={`w-full ${theme.paperBg}`}>
      <div className="relative mx-auto min-h-[80dvh] max-w-3xl px-5 py-16 sm:min-h-[85dvh] sm:px-10 sm:py-24">
        <div
          aria-hidden
          className="absolute right-6 top-10 h-16 w-16 -rotate-6 rounded-full border-2 border-dashed border-stone-300 sm:right-10 sm:top-16 sm:h-24 sm:w-24"
        />
        <EyebrowLabel area={area} industry={industry} tone="dark" theme={theme} />
        <HeroTitle
          heroTitle={heroTitle}
          storeName={storeName}
          heroTitleClass={heroTitleClass}
          className={`max-w-[13ch] ${theme.displayFont} ${theme.bodyText}`}
        />
        <p className={`mt-5 max-w-[32ch] [overflow-wrap:normal] text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
          {heroSubtitle}
        </p>
        <HeroEntryLinkOnLight ctaLabel={ctaLabel} ctaHref={ctaHref} theme={theme} />
        <p className={`mt-14 border-t pt-4 text-xs tracking-[0.2em] ${theme.accentTextSoft} border-stone-300`}>
          {storeName}
        </p>
      </div>
    </section>
  );
}

/** 写真0枚（composition="typographic"）: artDirectionごとに全く異なる意図的な構成を出す。 */
function TypographicHero(props: NoPhotoHeroProps & { artDirection: ArtDirection }) {
  if (props.artDirection === "japanese-editorial") return <JapaneseEditorialTypographicHero {...props} />;
  if (props.artDirection === "sensory-immersive") return <SensoryImmersiveTypographicHero {...props} />;
  return <WarmCraftTypographicHero {...props} />;
}

/**
 * カフェv2のHero。BrandPlan由来の`composition`により4種の構図を切り替える
 * （写真が無ければ呼び出し側が常に"typographic"を渡すため、このコンポーネント
 * 自身も念のため`photoUrl`の有無を最終防波堤としてチェックする）。
 * 「制作会社側の説明」は一切書かず、店の空気感・見出しコピー・単一のCTAのみを見せる。
 *
 * Hero写真の読み込みに失敗した場合、ページで最も目立つこの領域に中途半端な
 * 空面を残さないよう、`photoFailed`状態でno-photo構成（TypographicHero）へ
 * クライアント側で丸ごと切り替える。この判定はランタイムの読み込み結果に
 * 依存するため、このコンポーネント自体をクライアントコンポーネントにしている
 * （それ以外のロジックはサーバーコンポーネントのままでも成立する軽量な分岐のみ）。
 */
export function HeroV2(props: HeroV2Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const { photoUrl, composition } = props;

  if (!photoUrl || composition === "typographic" || photoFailed) {
    return <TypographicHero {...props} />;
  }
  const onHeroPhotoFail = () => setPhotoFailed(true);
  if (composition === "split-frame") {
    return <SplitFrameHero {...props} photoUrl={photoUrl} onHeroPhotoFail={onHeroPhotoFail} />;
  }
  if (composition === "overlap-editorial") {
    return <OverlapEditorialHero {...props} photoUrl={photoUrl} onHeroPhotoFail={onHeroPhotoFail} />;
  }
  return <FullBleedCenterHero {...props} photoUrl={photoUrl} onHeroPhotoFail={onHeroPhotoFail} />;
}
