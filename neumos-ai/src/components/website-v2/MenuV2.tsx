import type { RealMenuItem, WebsiteSection } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, SurfaceClasses } from "@/lib/engine/v2-design-system";
import { RevealV2 } from "./RevealV2";
import { SafeImageV2 } from "./SafeImageV2";

function MenuPhoto({ item, className }: { item: RealMenuItem; className: string }) {
  if (!item.imageUrl) return null;
  return (
    <SafeImageV2
      src={item.imageUrl}
      alt={`${item.name}のメニュー写真`}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

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
            <li key={`${item.name}-${i}`} className={`grid gap-4 border-b py-6 last:border-b-0 ${item.imageUrl ? "grid-cols-[6rem_1fr] sm:grid-cols-[8rem_1fr]" : "grid-cols-1"} ${surface.divider}`}>
              {item.imageUrl && (
                <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                  <MenuPhoto item={item} className="transition-transform duration-500 hover:scale-[1.03]" />
                </div>
              )}
              <div className="flex gap-4">
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
              </div>
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
          className={`mt-10 overflow-hidden ${surface.cardBg} ${surface.cardBorder}`}
        >
          {featured.imageUrl && (
            <div className="aspect-[16/9] overflow-hidden bg-stone-100 sm:aspect-[2/1]">
              <MenuPhoto item={featured} className="transition-transform duration-700 hover:scale-[1.025]" />
            </div>
          )}
          <div className="px-6 py-10 sm:px-12 sm:py-14">
            <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.accentTextSoft}`}>Featured</p>
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
              <h3 className={`text-3xl sm:text-4xl ${theme.displayFont} ${theme.bodyText}`}>{featured.name}</h3>
              {featured.price && <span className={`text-xl tabular-nums ${theme.bodyText}`}>{featured.price}</span>}
            </div>
            {featured.description && (
              <p className={`mt-3 max-w-[46ch] text-sm leading-relaxed sm:text-base ${theme.bodyTextSoft}`}>
                {featured.description}
              </p>
            )}
          </div>
        </RevealV2>

        {rest.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {rest.map((item, i) => (
              <RevealV2
                key={`${item.name}-${i}`}
                variant="fade-up"
                delayMs={i * 60}
                className={`grid items-center gap-4 border-b py-4 ${item.imageUrl ? "grid-cols-[5rem_1fr_auto]" : "grid-cols-[1fr_auto]"} ${surface.divider}`}
              >
                {item.imageUrl && <div className="aspect-square overflow-hidden"><MenuPhoto item={item} className="" /></div>}
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
              <RevealV2 variant="fade-up" delayMs={i * 60} className={`grid items-center gap-5 ${item.imageUrl ? "grid-cols-[7rem_1fr_auto]" : "grid-cols-[1fr_auto]"}`}>
                {item.imageUrl && (
                  <div className={`aspect-square overflow-hidden ${i % 2 === 0 ? "rotate-[-1deg]" : "rotate-[1deg]"}`}>
                    <MenuPhoto item={item} className="transition-transform duration-500 hover:scale-[1.03]" />
                  </div>
                )}
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
 * 実メニューデータが無い場合の代替表示。
 *
 * 以前は`sections`(kind="service"、AIが書いた紹介文)だけを「紹介文（AI生成）」
 * という単独カードで見せていたが、これは内容が一般的になりがちで弱く見える
 * という指摘を受けた。ここではまず、brief自身に実在する事実（提供内容・
 * こだわり・想定客層）を「提供内容」「こだわり」「こんな方に」という
 * 事実ベースの見出しつきで並べる編集的なパネルを主役にし、AIが書いた
 * 紹介文(`sections`)はその補足として下に添える（無ければ表示しない）。
 * 価格列や商品名の一覧は一切作らない（架空の商品・価格は出さない）。
 */
function GeneratedServiceOverview({
  offer,
  salesAngle,
  targetCustomer,
  sections,
  theme,
  surface,
  sectionHeadingClass,
}: {
  offer: string;
  salesAngle: string;
  targetCustomer: string;
  sections: WebsiteSection[];
  theme: CafeThemeV2;
  surface: SurfaceClasses;
  sectionHeadingClass: string;
}) {
  // 補足コピー(sections)が無い場合は文字量が少なく、既定の縦padding(py-16/24)
  // だと内容量に対して余白ばかりが目立つため、その分だけ詰める。
  const verticalPadding = sections.length > 0 ? "py-16 sm:py-24" : "py-12 sm:py-16";
  const facts: { label: string; value: string }[] = [
    { label: "提供内容", value: offer },
    { label: "こだわり", value: salesAngle },
    { label: "こんな方に", value: targetCustomer },
  ];

  return (
    <section id="menu" className={theme.paperBg}>
      <div className={`mx-auto max-w-4xl px-5 sm:px-10 lg:px-16 ${verticalPadding}`}>
        <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${theme.accentText}`}>About the service</p>
        <h2 className={`mt-4 ${sectionHeadingClass} ${theme.displayFont} ${theme.bodyText}`}>提供内容とこだわり</h2>

        <RevealV2
          variant="fade-up"
          className={`mt-10 grid grid-cols-1 gap-6 sm:mt-12 sm:grid-cols-3 sm:gap-8 ${surface.cardBg} ${surface.cardBorder} px-6 py-8 sm:px-10 sm:py-10`}
        >
          {facts.map((fact) => (
            <div key={fact.label}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${theme.accentTextSoft}`}>
                {fact.label}
              </p>
              <p className={`mt-2 [overflow-wrap:normal] text-sm leading-relaxed sm:text-base ${theme.bodyText}`}>
                {fact.value}
              </p>
            </div>
          ))}
        </RevealV2>

        {/*
          RevealV2は<div>を描画するため、<li>の外側に被せると<ul>の直接の子が
          <div>になり、支援技術向けのリスト構造が壊れる（axe-coreのlist/listitem
          違反として実際に検出された）。<li>自体はプレーンな直接の子のままにし、
          reveal演出は<li>の中身だけに適用する。
        */}
        {sections.length > 0 && (
          <ul className={`mt-10 border-t ${surface.divider}`}>
            {sections.map((s, i) => (
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
 * 無い場合は`brief.offer`を商品一覧・価格へ変換したりせず、brief自身の
 * 事実情報（提供内容・こだわり・想定客層）による編集的なパネルへ
 * 再構成する（架空の商品・価格は一切出さない）。offer/salesAngle/
 * targetCustomerはStoreBriefのバリデーションで必須(min(1))のため、
 * この代替表示が空虚になることはない。
 */
export function MenuV2({
  sections,
  menuItems,
  offer,
  salesAngle,
  targetCustomer,
  theme,
  surface,
  sectionHeadingClass,
  artDirection,
}: {
  sections: WebsiteSection[];
  menuItems?: RealMenuItem[];
  offer: string;
  salesAngle: string;
  targetCustomer: string;
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
  return (
    <GeneratedServiceOverview
      offer={offer}
      salesAngle={salesAngle}
      targetCustomer={targetCustomer}
      sections={sections}
      theme={theme}
      surface={surface}
      sectionHeadingClass={sectionHeadingClass}
    />
  );
}
