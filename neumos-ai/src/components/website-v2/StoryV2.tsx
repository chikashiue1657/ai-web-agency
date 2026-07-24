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
 * 割り当てた場合）は、本文を写真に重ねるパターンで見せる。テキストを
 * 置く側（左/右）は店名から決定論的に交互化し、同じレイアウトが毎回
 * 続く単調さを避ける。写真が無い場合はv1のAboutのような番号付きカードでは
 * なく、読みやすい行幅に絞った縦読みのエディトリアル構成にする。
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
      <section id="story" className="relative w-full overflow-hidden">
        <ParallaxImageV2 src={photoUrl} alt={`${storeName}の世界観`} />
        {/*
          Tailwindの静的解析はクラス名をリテラル文字列としてしか検出できないため、
          "bg-gradient-to-${side}"のように文字列の途中を差し替えるとCSSが
          生成されない（実際に確認済みの失敗パターン）。完全なクラス名同士を
          三項演算子で選ぶ。
        */}
        <div
          className={`absolute inset-0 ${
            textOnLeft
              ? "bg-gradient-to-r from-stone-950/85 via-stone-950/45 to-transparent"
              : "bg-gradient-to-l from-stone-950/85 via-stone-950/45 to-transparent"
          }`}
        />
        <div
          className={`relative flex min-h-[70vh] w-full items-center px-5 py-20 sm:min-h-[82vh] sm:px-10 sm:py-28 lg:px-16 ${
            textOnLeft ? "justify-start" : "justify-end"
          }`}
        >
          <div className="max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Story</p>
            <RevealV2>
              <p
                className={`mt-6 max-w-[28ch] break-keep break-words text-xl leading-relaxed sm:text-2xl sm:leading-[1.6] ${theme.displayFont} text-white`}
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
