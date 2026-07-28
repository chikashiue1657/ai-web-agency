import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { SurfaceClasses } from "@/lib/engine/v2-design-system";
import { RevealV2 } from "./RevealV2";

/**
 * 看板商品・来店理由を1つの大きな文として見せるセクション。
 * v1のFeatureのような同幅カードの反復は行わず、写真を挟まないテキスト主体の
 * セクションとして、前後の写真主体セクションとリズムを作る。
 */
export function SignatureV2({
  items,
  theme,
  surface,
}: {
  items: string[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
}) {
  if (items.length === 0) return null;
  const [lead, ...rest] = items;
  // 補足項目(rest)が無い場合は文字量が少なく、既定の縦padding(py-24/32)だと
  // 内容量に対して余白ばかりが目立つため、その分だけ詰める。
  const verticalPadding = rest.length > 0 ? "py-24 sm:py-32" : "py-16 sm:py-20";

  return (
    <section id="signature" className={`${theme.paperRaisedBg}`}>
      <div className={`mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 sm:grid-cols-[auto_1fr] sm:gap-10 sm:px-10 lg:px-16 ${verticalPadding}`}>
        <RevealV2 variant="fade">
          <p className={`text-6xl leading-none sm:text-8xl ${theme.displayFont} ${theme.accentTextSoft}`}>“</p>
        </RevealV2>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Signature</p>
          <RevealV2>
            <p
              className={`mt-4 max-w-[22ch] [overflow-wrap:normal] text-3xl leading-[1.15] sm:text-5xl sm:leading-[1.1] ${theme.displayFont} ${theme.bodyText}`}
            >
              {lead}
            </p>
          </RevealV2>
          {rest.length > 0 && (
            <ul className={`mt-8 flex max-w-xl flex-col gap-3 border-t pt-6 ${surface.divider}`}>
              {rest.map((line, i) => (
                <li key={i} className={`text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
