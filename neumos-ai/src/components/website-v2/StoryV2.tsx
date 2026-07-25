import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { splitBulletLines } from "@/components/website/utils";
import { RevealV2 } from "./RevealV2";
import { ParallaxImageV2 } from "./ParallaxImageV2";

/**
 * 店名から決定論的に左右を決める（同じ店なら常に同じ側、店ごとにはばらける）。
 * ランダムにすると生成のたびに結果が変わってしまい、比較検証や再現性が崩れるため、
 * 店名という安定した入力からハッシュを作る。
 */
function hashSide(seed: string): "left" | "right" {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "left" : "right";
}

/**
 * 店のストーリー。写真が確保できた場合（photo-strategy.tsがStory用に1枚
 * 割り当てた場合）は、本文を写真に重ねるパターンで見せる。
 *
 * PCとモバイルで構造そのものを分けている（同じDOMをCSSだけで縮小していない）。
 * PCは横方向のグラデーション＋写真への重ね書きが成立するが、モバイル幅では
 * 文字がグラデーションの薄い側（transparent側）まではみ出し、写真の明暗次第で
 * 読めたり読めなかったりする実バグがあった（本文が画像領域や区切り線へ
 * 食い込む・装飾文字と衝突する、として実際に報告された）。モバイルは
 * 「写真（短いラベルのみ）→小見出し→本文→根拠」の縦積みにし、本文は
 * 常に不透明な背景の上に置くことで、写真の内容に関係なく可読性を保証する。
 * 高さはmin-heightやabsoluteで固定せず、写真はaspect-ratioで自然に、
 * 本文はコンテンツ量に応じて自然に伸びる。
 *
 * 写真が無い場合はv1のAboutのような番号付きカードではなく、読みやすい
 * 行幅に絞った縦読みのエディトリアル構成にする（PC/モバイル共通）。
 */
export function StoryV2({
  storeName,
  concept,
  sections,
  photoUrl,
  theme,
}: {
  storeName: string;
  concept: string;
  sections: WebsiteSection[];
  photoUrl?: string;
  theme: CafeThemeV2;
}) {
  const points = sections.flatMap((s) => splitBulletLines(s.body));

  if (photoUrl) {
    const textOnLeft = hashSide(storeName) === "left";
    return (
      <section id="story" className="w-full">
        {/*
          モバイル専用: 写真は短いラベルだけを乗せ、本文は不透明な背景の上に縦積みする。
          パララックス（scale＋スクロール連動）は使わない。小さなラベル用バナーに
          scale変形を掛けるとoverflow-hiddenで包んでも収まりの調整が増えるだけで
          得られる効果が小さく、モバイルは軽量・簡潔に保つ方を優先した。
        */}
        <div className="block sm:hidden">
          <div className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt={`${storeName}の世界観`} className="aspect-[4/3] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-950/15 to-transparent" />
            <p className="absolute bottom-4 left-5 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              Story
            </p>
          </div>
          <div className={`${theme.paperRaisedBg} px-5 py-10`}>
            <RevealV2>
              <p
                className={`max-w-[30ch] break-keep break-words text-xl leading-relaxed ${theme.displayFont} ${theme.bodyText}`}
              >
                {concept}
              </p>
            </RevealV2>
            {points.length > 0 && (
              <ul className="mt-6 flex flex-col gap-3 border-t border-stone-200 pt-6">
                {points.slice(0, 3).map((point, i) => (
                  <li key={i} className={`text-sm leading-relaxed ${theme.bodyTextSoft}`}>
                    {point}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* PC専用: 写真に本文を重ねる。左右は店名から決定論的に交互化。 */}
        <div className="relative hidden w-full overflow-hidden sm:block">
          <ParallaxImageV2 src={photoUrl} alt={`${storeName}の世界観`} />
          {/*
            Tailwindの静的解析はクラス名をリテラル文字列としてしか検出できないため、
            "bg-gradient-to-${side}"のように文字列の途中を差し替えるとCSSが
            生成されない（実際に確認済みの失敗パターン）。完全なクラス名同士を
            三項演算子で選ぶ。
            画像の色に文字の可読性が依存しないよう、"到達点"も完全な透明にはせず
            画像全面に最低限の暗さを敷く（from-950/90 → via-950/60 → to-950/10）。
          */}
          <div
            className={`absolute inset-0 ${
              textOnLeft
                ? "bg-gradient-to-r from-stone-950/90 via-stone-950/60 to-stone-950/10"
                : "bg-gradient-to-l from-stone-950/90 via-stone-950/60 to-stone-950/10"
            }`}
          />
          <div
            className={`relative flex min-h-[70vh] w-full items-center px-10 py-28 lg:px-16 ${
              textOnLeft ? "justify-start" : "justify-end"
            }`}
          >
            <div className="max-w-md">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Story</p>
              <RevealV2>
                <p
                  className={`mt-6 max-w-[28ch] break-keep break-words text-2xl leading-[1.6] ${theme.displayFont} text-white`}
                >
                  {concept}
                </p>
              </RevealV2>
              {points.length > 0 && (
                <RevealV2 delayMs={150}>
                  <ul className="mt-6 flex flex-col gap-3 border-t border-white/20 pt-6">
                    {points.slice(0, 3).map((point, i) => (
                      <li key={i} className="text-sm leading-relaxed text-white/80">
                        {point}
                      </li>
                    ))}
                  </ul>
                </RevealV2>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const isThin = points.length === 0;
  return (
    <section id="story" className={theme.paperRaisedBg}>
      <div className={`mx-auto max-w-3xl px-5 sm:px-10 lg:px-0 ${isThin ? "py-28 sm:py-36" : "py-20 sm:py-28"}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Story</p>
        <RevealV2>
          <p
            className={`mt-6 max-w-[34ch] break-keep break-words text-xl leading-relaxed sm:max-w-none sm:text-2xl sm:leading-[1.7] ${theme.displayFont} ${theme.bodyText}`}
          >
            {concept}
          </p>
        </RevealV2>

        {points.length > 0 && (
          <ul className="mt-10 flex flex-col gap-5 border-t border-stone-200 pt-8">
            {points.map((point, i) => (
              <li key={i} className={`flex gap-4 text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                <span className={`shrink-0 text-xs ${theme.accentTextSoft}`}>{String(i + 1).padStart(2, "0")}</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
