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

  return (
    <section id="signature" className={`${theme.paperRaisedBg}`}>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-5 py-24 sm:grid-cols-[auto_1fr] sm:gap-10 sm:px-10 sm:py-32 lg:px-16">
        <RevealV2 variant="fade">
          <p className={`text-6xl leading-none sm:text-8xl ${theme.displayFont} ${theme.accentTextSoft}`}>“</p>
        </RevealV2>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Signature</p>
          <RevealV2>
            <p
              className={`mt-4 max-w-[22ch] break-keep break-words text-3xl leading-[1.15] sm:text-5xl sm:leading-[1.1] ${theme.displayFont} ${theme.bodyText}`}
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
