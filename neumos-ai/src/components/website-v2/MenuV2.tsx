import type { RealMenuItem, WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, SurfaceClasses } from "@/lib/engine/v2-design-system";
import { RevealV2 } from "./RevealV2";

/**
 * 実メニュー品目(`realData.menuItems`)がある場合だけ表示する、品名+価格の
 * 実際のメニュー表。価格は右揃え・tabular-numsで整列させる。
 * 実データのみを描画するため、ここでは一切文言を生成・補完しない。
 *
 * artDirectionでレイアウトを変える。
 *  - japanese-editorial: ノンブル付きの静かな1カラムリスト。
 *  - sensory-immersive: 先頭の品目だけ大きな「主役」カードにし、残りを
 *    その下の詰めたグリッドに流し込む（Menuを視覚的な中心にする）。
 *  - warm-craft: 罫線区切りの通しリスト（従来の構成）。
 */
function EditorialMenuList({ items, theme, surface, sectionHeadingClass }: RealMenuListProps) {
  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-2xl px-5 py-20 sm:px-10 sm:py-28 lg:px-0">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Menu</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>メニュー</h2>

        <ul className={`mt-10 border-t ${surface.divider}`}>
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className={`flex gap-4 border-b py-6 last:border-b-0 ${surface.divider}`}>
              <span className={`shrink-0 text-xs ${theme.accentTextSoft}`}>{String(i + 1).padStart(2, "0")}</span>
              <RevealV2 variant="fade-up" delayMs={i * 60} className="flex flex-1 items-baseline justify-between gap-6">
                <div className="min-w-0">
                  <h3 className={`text-lg ${theme.displayFont} ${theme.bodyText}`}>{item.name}</h3>
                  {item.description && (
                    <p className={`mt-1 text-sm leading-relaxed ${theme.bodyTextSoft}`}>{item.description}</p>
                  )}
                </div>
                {item.price && (
                  <span className={`shrink-0 text-sm tabular-nums ${theme.bodyText}`}>{item.price}</span>
                )}
              </RevealV2>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ImmersiveMenuList({ items, theme, surface, sectionHeadingClass }: RealMenuListProps) {
  const [featured, ...rest] = items;
  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-5xl px-5 py-16 sm:px-10 sm:py-24 lg:px-16">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Menu</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>メニュー</h2>

        <RevealV2
          variant="fade-up"
          className={`mt-10 ${surface.cardBg} ${surface.cardBorder} px-6 py-10 sm:px-12 sm:py-14`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.accentTextSoft}`}>Featured</p>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
            <h3 className={`text-3xl sm:text-4xl ${theme.displayFont} ${theme.bodyText}`}>{featured.name}</h3>
            {featured.price && (
              <span className={`text-xl tabular-nums ${theme.bodyText}`}>{featured.price}</span>
            )}
          </div>
          {featured.description && (
            <p className={`mt-3 max-w-[46ch] text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
              {featured.description}
            </p>
          )}
        </RevealV2>

        {rest.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map((item, i) => (
              <RevealV2
                key={`${item.name}-${i}`}
                variant="fade-up"
                delayMs={i * 60}
                className={`flex items-baseline justify-between gap-4 border-b py-4 ${surface.divider}`}
              >
                <h4 className={`text-base ${theme.displayFont} ${theme.bodyText}`}>{item.name}</h4>
                {item.price && <span className={`shrink-0 text-sm tabular-nums ${theme.bodyText}`}>{item.price}</span>}
              </RevealV2>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CraftMenuList({ items, theme, surface, sectionHeadingClass }: RealMenuListProps) {
  return (
    <section id="menu" className={theme.paperBg}>
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-10 sm:py-24 lg:px-16">
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>Menu</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>メニュー</h2>

        <ul className={`mt-10 border-t ${surface.divider}`}>
          {items.map((item, i) => (
            <li key={`${item.name}-${i}`} className={`border-b py-6 last:border-b-0 ${surface.divider}`}>
              <RevealV2 variant="fade-up" delayMs={i * 60} className="flex items-baseline justify-between gap-6">
                <div className="min-w-0">
                  <h3 className={`text-lg sm:text-xl ${theme.displayFont} ${theme.bodyText}`}>{item.name}</h3>
                  {item.description && (
                    <p className={`mt-1 text-sm leading-relaxed ${theme.bodyTextSoft}`}>{item.description}</p>
                  )}
                </div>
                {item.price && (
                  <span className={`shrink-0 text-sm tabular-nums sm:text-base ${theme.bodyText}`}>{item.price}</span>
                )}
              </RevealV2>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

interface RealMenuListProps {
  items: RealMenuItem[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  sectionHeadingClass: string;
}

function RealMenuList(props: RealMenuListProps & { artDirection: ArtDirection }) {
  if (props.artDirection === "japanese-editorial") return <EditorialMenuList {...props} />;
  if (props.artDirection === "sensory-immersive") return <ImmersiveMenuList {...props} />;
  return <CraftMenuList {...props} />;
}

/**
 * 実メニューデータが無い場合の代替表示。`brief.offer`由来の生成コピー
 * (`sections`のkind="service")はあくまでAIが書いた紹介文であり、実在する
 * 商品名・価格の一覧ではないため、「メニュー」を名乗らず・価格列を持たず、
 * 生成コピーであることが分かるラベルを添えて紹介文として見せる。
 */
function GeneratedServiceOverview({
  sections,
  theme,
  surface,
  sectionHeadingClass,
}: {
  sections: WebsiteSection[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  sectionHeadingClass: string;
}) {
  const [featured, ...rest] = sections;
  // 補足セクション(rest)が無い場合は文字量が少なく、既定の縦padding(py-16/24)
  // だと内容量に対して余白ばかりが目立つため、その分だけ詰める。
  const verticalPadding = rest.length > 0 ? "py-16 sm:py-24" : "py-12 sm:py-16";

  return (
    <section id="menu" className={theme.paperBg}>
      <div className={`mx-auto max-w-4xl px-5 sm:px-10 lg:px-16 ${verticalPadding}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>About the service</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>サービスについて</h2>

        <RevealV2
          variant="fade-up"
          className={`mt-10 ${surface.cardBg} ${surface.cardBorder} px-6 py-8 sm:mt-12 sm:px-10 sm:py-10`}
        >
          <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.accentTextSoft}`}>
            紹介文（AI生成）
          </p>
          <h3 className={`mt-3 text-2xl sm:text-3xl ${theme.displayFont} ${theme.bodyText}`}>{featured.heading}</h3>
          <p className={`mt-3 whitespace-pre-line text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
            {featured.body}
          </p>
        </RevealV2>

        {/*
          RevealV2は<div>を描画するため、<li>の外側に被せると<ul>の直接の子が
          <div>になり、支援技術向けのリスト構造が壊れる（axe-coreのlist/listitem
          違反として実際に検出された）。<li>自体はプレーンな直接の子のままにし、
          reveal演出は<li>の中身だけに適用する。
        */}
        {rest.length > 0 && (
          <ul className={`mt-4 border-t ${surface.divider}`}>
            {rest.map((s, i) => (
              <li key={s.id} className={`border-b py-7 last:border-b-0 ${surface.divider}`}>
                <RevealV2
                  variant="fade-up"
                  delayMs={i * 60}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-baseline sm:gap-10"
                >
                  <h4 className={`text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{s.heading}</h4>
                  <p className={`whitespace-pre-line text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                    {s.body}
                  </p>
                </RevealV2>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * 実メニュー(`menuItems`)がある場合だけ品名+価格の実際のメニュー表を出す。
 * 無い場合は`brief.offer`を商品一覧・価格へ変換したりせず、生成コピーによる
 * 「サービスについて」の紹介文へ再構成する（架空の商品・価格は一切出さない）。
 * どちらの元データも無ければ何も描画しない。
 */
export function MenuV2({
  sections,
  menuItems,
  theme,
  surface,
  sectionHeadingClass,
  artDirection,
}: {
  sections: WebsiteSection[];
  menuItems?: RealMenuItem[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  sectionHeadingClass: string;
  artDirection: ArtDirection;
}) {
  if (menuItems && menuItems.length > 0) {
    return (
      <RealMenuList
        items={menuItems}
        theme={theme}
        surface={surface}
        sectionHeadingClass={sectionHeadingClass}
        artDirection={artDirection}
      />
    );
  }
  if (sections.length === 0) return null;
  return (
    <GeneratedServiceOverview
      sections={sections}
      theme={theme}
      surface={surface}
      sectionHeadingClass={sectionHeadingClass}
    />
  );
}
