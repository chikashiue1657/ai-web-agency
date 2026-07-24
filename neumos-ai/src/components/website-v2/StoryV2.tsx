import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import { splitBulletLines } from "@/components/website/utils";
import { RevealV2 } from "./RevealV2";

/**
 * 店のストーリー。v1のAboutのような「写真＋左右対称の番号付きカード」構成を
 * やめ、読みやすい行幅（60〜70字程度）に絞った縦読みのエディトリアル構成にする。
 * 写真はHero/PhotoStoryで既に使っているため、ここでは重複させず文章のみで見せる。
 * about相当のセクションが無い場合はconceptだけになるが、その分上下の余白を
 * 広く取ることで「情報が薄い」印象を消す。
 */
export function StoryV2({
  concept,
  sections,
  theme,
}: {
  concept: string;
  sections: WebsiteSection[];
  theme: CafeThemeV2;
}) {
  const points = sections.flatMap((s) => splitBulletLines(s.body));
  const isThin = points.length === 0;

  return (
    <section id="story" className={theme.paperRaisedBg}>
      <div className={`mx-auto max-w-3xl px-5 sm:px-10 lg:px-0 ${isThin ? "py-24 sm:py-32" : "py-16 sm:py-24"}`}>
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
