"use client";
import { useState } from "react";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ImageTreatment, SurfaceClasses } from "@/lib/engine/v2-design-system";
import { RevealV2 } from "./RevealV2";
import { SafeImageV2 } from "./SafeImageV2";
import { GooglePhotoAttributionV2 } from "./GooglePhotoAttributionV2";

/**
 * Gallery（写真セクション）。写真サイズを固定しない。1枚のときだけ
 * 意図的に横長バナーとして見せ、2枚以上はすべて同じ仕組み（列に自然な高さで
 * 流し込むPinterest風Masonry）で扱う。画像自身のaspect-ratioを固定しないため、
 * 縦長・横長・正方形が混在してもレイアウトが破綻しない。列数だけを枚数に
 * 応じて増減させ、"3〜4枚だけ特別な矩形グリッド"のような枚数ごとの専用
 * レイアウトは持たない（=固定パターンの反復を避ける）。
 *
 * `treatment`はBrandPlan.visualDirection.photoTreatment由来（省略時は"full-bleed"）。
 * "full-bleed"はこのデザイン刷新前からの既定と同一（余白ほぼ無し・辺いっぱい）。
 * "framed"は左右に余白を持たせ写真1枚ずつを枠で囲う。"mixed"は先頭の写真だけ
 * 大きく見せ、残りを詰めた小さめグリッドに流し込む（雑誌の特集ページのような
 * 強弱のある構成）。
 *
 * 個々の写真が読み込みに失敗した場合、CSS Grid/columnsのレイアウトから
 * その枠を除外して残りの写真だけで自然に詰め直す（collapseOnFail）。
 * 表示対象の写真が全滅した場合は、このコンポーネント自体が最初から
 * photoUrls=[]で呼ばれた場合と同じ扱いにする（セクションごと非表示）。
 * これは実行時の読み込み結果に依存する判定のため、このコンポーネントを
 * クライアントコンポーネントにしている。
 */
function columnsForCount(count: number): string {
  if (count === 2) return "columns-1 sm:columns-2";
  if (count <= 4) return "columns-2 sm:columns-2 lg:columns-3";
  return "columns-2 sm:columns-3 lg:columns-4";
}

function FullBleedGallery({
  storeName,
  photoUrls,
  onPhotoFail,
}: {
  storeName: string;
  photoUrls: string[];
  onPhotoFail: (url: string) => void;
}) {
  const count = photoUrls.length;
  return (
    <>
      {count === 1 && (
        <RevealV2 variant="scale">
          <SafeImageV2
            src={photoUrls[0]}
            alt={`${storeName}の写真`}
            className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
            collapseOnFail
            onFail={() => onPhotoFail(photoUrls[0])}
          />
          <GooglePhotoAttributionV2 photoUrl={photoUrls[0]} />
        </RevealV2>
      )}
      {count >= 2 && (
        <div className={`${columnsForCount(count)} gap-1 px-1 sm:gap-2 sm:px-2`}>
          {photoUrls.map((url, i) => (
            <RevealV2 key={url} variant="scale" delayMs={(i % 6) * 70} className="mb-1 break-inside-avoid sm:mb-2">
              <SafeImageV2
                src={url}
                alt={`${storeName}の写真`}
                className="block w-full"
                collapseOnFail
                onFail={() => onPhotoFail(url)}
              />
              <GooglePhotoAttributionV2 photoUrl={url} />
            </RevealV2>
          ))}
        </div>
      )}
    </>
  );
}

function FramedGallery({
  storeName,
  photoUrls,
  surface,
  onPhotoFail,
}: {
  storeName: string;
  photoUrls: string[];
  surface: SurfaceClasses;
  onPhotoFail: (url: string) => void;
}) {
  const count = photoUrls.length;
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
      {count === 1 && (
        <RevealV2 variant="scale">
          <SafeImageV2
            src={photoUrls[0]}
            alt={`${storeName}の写真`}
            className={`aspect-[16/9] w-full object-cover ${surface.cardBorder}`}
            collapseOnFail
            onFail={() => onPhotoFail(photoUrls[0])}
          />
          <GooglePhotoAttributionV2 photoUrl={photoUrls[0]} />
        </RevealV2>
      )}
      {count >= 2 && (
        <div className={`${columnsForCount(count)} gap-4 sm:gap-6`}>
          {photoUrls.map((url, i) => (
            <RevealV2 key={url} variant="scale" delayMs={(i % 6) * 70} className="mb-4 break-inside-avoid sm:mb-6">
              <SafeImageV2
                src={url}
                alt={`${storeName}の写真`}
                className={`block w-full ${surface.cardBorder}`}
                collapseOnFail
                onFail={() => onPhotoFail(url)}
              />
              <GooglePhotoAttributionV2 photoUrl={url} />
            </RevealV2>
          ))}
        </div>
      )}
    </div>
  );
}

function MixedEditorialGallery({
  storeName,
  photoUrls,
  onPhotoFail,
}: {
  storeName: string;
  photoUrls: string[];
  onPhotoFail: (url: string) => void;
}) {
  const [featured, ...rest] = photoUrls;
  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-10">
      <RevealV2 variant="scale">
        <SafeImageV2
          src={featured}
          alt={`${storeName}の写真`}
          className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]"
          collapseOnFail
          onFail={() => onPhotoFail(featured)}
        />
        <GooglePhotoAttributionV2 photoUrl={featured} />
      </RevealV2>
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {rest.slice(0, 7).map((url, i) => (
            <RevealV2 key={url} variant="scale" delayMs={(i % 6) * 70}>
              <SafeImageV2
                src={url}
                alt={`${storeName}の写真`}
                className="aspect-square w-full object-cover"
                collapseOnFail
                onFail={() => onPhotoFail(url)}
              />
              <GooglePhotoAttributionV2 photoUrl={url} />
            </RevealV2>
          ))}
        </div>
      )}
    </div>
  );
}

export function PhotoStoryV2({
  storeName,
  photoUrls,
  theme,
  treatment = "full-bleed",
  surface,
  sectionId = "photo-story",
}: {
  storeName: string;
  photoUrls: string[];
  theme: CafeThemeV2;
  treatment?: ImageTreatment;
  surface: SurfaceClasses;
  /** sensory-immersive方向で2箇所目のフォトセクションを描画する場合に別idを渡す(重複id防止)。 */
  sectionId?: string;
}) {
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set());
  const onPhotoFail = (url: string) => setFailedUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  if (photoUrls.length === 0) return null;
  // 表示対象の写真が全滅したら、写真0枚だった場合と同様にセクション自体を出さない。
  if (photoUrls.every((url) => failedUrls.has(url))) return null;

  return (
    <section id={sectionId} className={`${theme.paperBg} py-10 sm:py-14`}>
      {treatment === "framed" && (
        <FramedGallery storeName={storeName} photoUrls={photoUrls} surface={surface} onPhotoFail={onPhotoFail} />
      )}
      {treatment === "mixed" && photoUrls.length >= 2 && (
        <MixedEditorialGallery storeName={storeName} photoUrls={photoUrls} onPhotoFail={onPhotoFail} />
      )}
      {(treatment === "full-bleed" || (treatment === "mixed" && photoUrls.length < 2)) && (
        <FullBleedGallery storeName={storeName} photoUrls={photoUrls} onPhotoFail={onPhotoFail} />
      )}
    </section>
  );
}
