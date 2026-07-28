"use client";
import { useState } from "react";
import type { WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { SurfaceClasses } from "@/lib/engine/v2-design-system";
import { splitBulletLines } from "@/components/website/utils";
import { RevealV2 } from "./RevealV2";
import { SafeImageV2 } from "./SafeImageV2";

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
 * 割り当てた場合）は、写真をそのまま見せた上で、本文は写真の外側の独立した
 * surface（不透明な面）に置く。
 *
 * 以前は写真に暗いグラデーションを重ねて文字を載せる構成だったが、これは
 * 「写真を暗く覆い隠さない」「可読性が保証できない場合は文字を独立surfaceへ
 * 置く」という方針に反するため撤廃した。写真の内容に関係なく常に可読性を
 * 保証でき、モバイル/PCで別のDOM構造を持つ必要もなくなった（以前は
 * モバイル幅でグラデーションの薄い側まで文字がはみ出し読めなくなる実バグが
 * あり、そのために構造を分けていたが、この設計ではその種のバグが構造的に
 * 起こらない）。
 *
 * 左右の寄せは店名から決定論的に選び、店ごとの単調さを避ける。
 * 写真が無い場合はv1のAboutのような番号付きカードではなく、読みやすい
 * 行幅に絞った縦読みのエディトリアル構成にする。
 */
export function StoryV2({
  storeName,
  concept,
  sections,
  photoUrl,
  theme,
  surface,
}: {
  storeName: string;
  concept: string;
  sections: WebsiteSection[];
  photoUrl?: string;
  theme: CafeThemeV2;
  surface: SurfaceClasses;
}) {
  const points = sections.flatMap((s) => splitBulletLines(s.body));
  // 写真の読み込みに失敗した場合、aspect-ratio分の空面(壊れた画像の痕跡)を
  // 残さないよう、写真なしのエディトリアル構成(下のisThin分岐)へ丸ごと切り替える。
  const [photoFailed, setPhotoFailed] = useState(false);

  if (photoUrl && !photoFailed) {
    const textOnRight = hashSide(storeName) === "right";
    return (
      <section id="story" className={`w-full ${theme.paperBg}`}>
        <div className="relative w-full overflow-hidden">
          <SafeImageV2
            src={photoUrl}
            alt={`${storeName}の写真`}
            className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
            collapseOnFail
            onFail={() => setPhotoFailed(true)}
          />
        </div>
        <div
          className={`mx-auto flex max-w-6xl px-5 py-10 sm:px-10 sm:py-14 lg:px-16 ${
            textOnRight ? "lg:justify-end" : "lg:justify-start"
          }`}
        >
          <div className={`w-full max-w-xl ${textOnRight ? "lg:text-right" : ""}`}>
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Story</p>
            <RevealV2>
              <p
                className={`mt-6 max-w-[34ch] [overflow-wrap:normal] text-xl leading-relaxed sm:max-w-none sm:text-2xl sm:leading-[1.7] ${theme.displayFont} ${theme.bodyText} ${textOnRight ? "lg:ml-auto" : ""}`}
              >
                {concept}
              </p>
            </RevealV2>
            {points.length > 0 && (
              <ul
                className={`mt-8 flex flex-col gap-4 border-t pt-6 ${surface.divider} ${textOnRight ? "lg:items-end" : ""}`}
              >
                {points.slice(0, 3).map((point, i) => (
                  <li key={i} className={`max-w-[30ch] text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                    {point}
                  </li>
                ))}
              </ul>
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
            className={`mt-6 max-w-[34ch] [overflow-wrap:normal] text-xl leading-relaxed sm:max-w-none sm:text-2xl sm:leading-[1.7] ${theme.displayFont} ${theme.bodyText}`}
          >
            {concept}
          </p>
        </RevealV2>

        {points.length > 0 && (
          <ul className={`mt-10 flex flex-col gap-5 border-t pt-8 ${surface.divider}`}>
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
