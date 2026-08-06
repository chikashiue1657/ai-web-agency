import type { AccessInfo, ContactMethod, StoreRealData, WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, CtaStyle, SurfaceClasses } from "@/lib/engine/v2-design-system";
import { AccessHoursV2 } from "../AccessHoursV2";
import { CTAV2 } from "../CTAV2";

/**
 * Utility Layer。Editorial Layer(編集パイプラインの出力)とは完全に独立し、
 * Presentation/Arrangeの並び替えや演出の影響を受けず、常に静的に表示する。
 * neumos-ai/docs/design/editorial-pipeline-design.md 12章。
 *
 * 既存の`AccessHoursV2`(地図・営業時間・住所)・`CTAV2`(予約導線)の実務情報
 * 描画をそのまま再利用する(新規に書き直さない)。これらは既に「意味判断なしに
 * 実データをそのまま出す」実装のため、Utility Layerの責務とそのまま一致する。
 */
export function UtilityLayerV2({
  storeName,
  access,
  realData,
  cta,
  contactMethods,
  theme,
  surface,
  artDirection,
  ctaStyle,
}: {
  storeName: string;
  access: AccessInfo;
  realData?: StoreRealData;
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  artDirection: ArtDirection;
  ctaStyle: CtaStyle;
}) {
  return (
    <>
      <AccessHoursV2
        storeName={storeName}
        access={access}
        realData={realData}
        theme={theme}
        surface={surface}
        artDirection={artDirection}
      />
      <CTAV2 cta={cta} contactMethods={contactMethods} theme={theme} ctaStyle={ctaStyle} artDirection={artDirection} />
    </>
  );
}
