import type { ContactMethod, WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { ArtDirection, CtaStyle } from "@/lib/engine/v2-design-system";

/**
 * 最終CTA。hrefはbrief.realDataに基づき`buildCtaWithRealLinks`/
 * `buildContactMethodsWithRealLinks`が既に確定させた値をそのまま使う
 * （このコンポーネントではリンク生成ロジックに一切触れない）。
 *
 * `ctaStyle`はBrandPlan.ctaStrategy.urgency由来（省略時は"outline-minimal"で
 * 従来と同一の見た目）。新しい訴求文言は一切作らない（ボタンの視覚的な強さ
 * だけを変える。捏造した緊急性の煽り文句は追加しない）。
 *
 * `artDirection`でセクション自体のレイアウトを変える。
 *  - japanese-editorial: 明るい紙面に細い罫線を添えた、静かな中央寄せ。
 *    他の方向のような濃色の大きなブロックにはしない。
 *  - sensory-immersive: PC幅では見出し/本文とボタン/連絡先を左右に分け、
 *    中央寄せの縦積みから脱する。
 *  - warm-craft: 濃色ブロック＋中央寄せの縦積み（従来の構成）。
 *
 * `variant`はBrand Director接続用の任意拡張（省略時は既定の"primary"）。
 * BrandPlan.ctaStrategy.placementが"after-story"の場合のみ、storyの直後にも
 * 控えめな"compact"版を追加で表示する（既存の文末CTAはそのまま残す＝削除しない）。
 */
function PrimaryCtaButton({
  href,
  label,
  ctaStyle,
  onLight = false,
  theme,
}: {
  href: string;
  label: string;
  ctaStyle: CtaStyle;
  onLight?: boolean;
  theme?: CafeThemeV2;
}) {
  if (ctaStyle === "text-link") {
    return (
      <a
        href={href}
        className={`mt-12 inline-flex w-fit items-center gap-2 border-b pb-1 text-sm font-medium transition hover:gap-3 sm:mt-14 sm:text-base ${
          onLight ? `border-current ${theme?.accentText ?? ""}` : "border-white/70 text-white hover:border-white"
        }`}
      >
        {label}
        <span aria-hidden>→</span>
      </a>
    );
  }
  if (ctaStyle === "solid-bold") {
    return (
      <a
        href={href}
        className={`mt-12 inline-flex items-center justify-center rounded-full px-10 py-4 text-sm font-semibold transition sm:mt-14 sm:text-base ${
          onLight
            ? `${theme?.ctaBg ?? "bg-stone-900"} ${theme?.ctaText ?? "text-white"} hover:opacity-90`
            : "bg-white text-stone-950 hover:bg-white/90"
        }`}
      >
        {label}
      </a>
    );
  }
  // "outline-minimal"（既定）。
  return (
    <a
      href={href}
      className={`mt-12 inline-flex items-center justify-center rounded-full border px-9 py-3.5 text-sm font-medium transition sm:mt-14 sm:text-base ${
        onLight
          ? `border-current ${theme?.accentText ?? ""} hover:bg-black/5`
          : "border-white/70 text-white hover:bg-white hover:text-stone-950"
      }`}
    >
      {label}
    </a>
  );
}

function CompactCtaButton({
  href,
  label,
  ctaStyle,
  theme,
}: {
  href: string;
  label: string;
  ctaStyle: CtaStyle;
  theme: CafeThemeV2;
}) {
  if (ctaStyle === "solid-bold") {
    return (
      <a
        href={href}
        className={`mt-6 inline-flex items-center justify-center rounded-full ${theme.ctaBg} px-8 py-3 text-sm font-medium ${theme.ctaText} transition hover:opacity-90 sm:text-base`}
      >
        {label}
      </a>
    );
  }
  if (ctaStyle === "text-link") {
    return (
      <a
        href={href}
        className={`mt-6 inline-flex w-fit items-center gap-2 border-b pb-1 text-sm font-medium transition hover:gap-3 ${theme.bodyText}`}
      >
        {label}
        <span aria-hidden>→</span>
      </a>
    );
  }
  // "outline-minimal"
  return (
    <a
      href={href}
      className={`mt-6 inline-flex items-center justify-center rounded-full border border-current px-8 py-3 text-sm font-medium transition hover:opacity-70 sm:text-base ${theme.bodyText}`}
    >
      {label}
    </a>
  );
}

function ContactMethodList({ contactMethods, onLight = false }: { contactMethods: ContactMethod[]; onLight?: boolean }) {
  if (contactMethods.length === 0) return null;
  const chipClass = onLight
    ? "inline-block rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-black/5 sm:text-sm"
    : "inline-block rounded-full border border-white/25 px-4 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/10 sm:text-sm";
  return (
    <ul className="mt-9 flex flex-wrap items-center justify-center gap-3">
      {contactMethods.map((method) =>
        method.href ? (
          <li key={method.label}>
            <a
              href={method.href}
              target={method.href.startsWith("http") ? "_blank" : undefined}
              rel={method.href.startsWith("http") ? "noreferrer" : undefined}
              className={chipClass}
            >
              {method.label}
            </a>
          </li>
        ) : (
          <li key={method.label} className={chipClass.replace("hover:bg-black/5", "").replace("hover:bg-white/10", "")}>
            {method.label}
          </li>
        )
      )}
    </ul>
  );
}

/** japanese-editorial: 明るい紙面に細い罫線を添えた静かな中央寄せ。 */
function EditorialCta({
  cta,
  contactMethods,
  theme,
  ctaStyle,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  ctaStyle: CtaStyle;
}) {
  return (
    <section id="contact" className={theme.paperBg}>
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center sm:py-36">
        <div className={`w-10 border-t ${theme.accentTextSoft} border-current`} />
        <h2 className={`mt-8 text-xl sm:text-2xl ${theme.displayFont} ${theme.bodyText}`}>{cta.headline}</h2>
        <p className={`mt-4 max-w-md text-sm sm:text-base ${theme.bodyTextSoft}`}>{cta.body}</p>
        <PrimaryCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} onLight theme={theme} />
        <div className="mt-9">
          <ContactMethodList contactMethods={contactMethods} onLight />
        </div>
      </div>
    </section>
  );
}

/** sensory-immersive: PC幅で見出し/本文とボタン/連絡先を左右に分ける。 */
function ImmersiveCta({
  cta,
  contactMethods,
  theme,
  ctaStyle,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  ctaStyle: CtaStyle;
}) {
  return (
    <section id="contact" className={theme.ctaBg}>
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-5 py-24 sm:py-32 lg:flex-row lg:items-center lg:justify-between lg:px-16 lg:py-28">
        <div className="text-center lg:text-left">
          <h2 className={`text-2xl sm:text-3xl ${theme.ctaText} ${theme.displayFont}`}>{cta.headline}</h2>
          <p className="mt-4 max-w-md text-sm text-white/80 sm:text-base">{cta.body}</p>
        </div>
        <div className="flex flex-col items-center lg:items-end">
          <PrimaryCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} />
          <ContactMethodList contactMethods={contactMethods} />
        </div>
      </div>
    </section>
  );
}

/** warm-craft: 濃色ブロック＋中央寄せの縦積み（従来の構成）。 */
function CraftCta({
  cta,
  contactMethods,
  theme,
  ctaStyle,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  ctaStyle: CtaStyle;
}) {
  return (
    <section id="contact" className={theme.ctaBg}>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center sm:py-40">
        <h2 className={`text-2xl sm:text-3xl ${theme.ctaText} ${theme.displayFont}`}>{cta.headline}</h2>
        <p className="mt-4 max-w-md text-sm text-white/80 sm:text-base">{cta.body}</p>
        <PrimaryCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} />
        <ContactMethodList contactMethods={contactMethods} />
      </div>
    </section>
  );
}

export function CTAV2({
  cta,
  contactMethods,
  theme,
  variant = "primary",
  ctaStyle = "outline-minimal",
  artDirection,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  variant?: "primary" | "compact";
  ctaStyle?: CtaStyle;
  artDirection: ArtDirection;
}) {
  if (variant === "compact") {
    return (
      <section className={`${theme.paperRaisedBg} px-5 py-16 text-center sm:py-20`}>
        <h2 className={`text-xl ${theme.bodyText} ${theme.displayFont} sm:text-2xl`}>{cta.headline}</h2>
        <CompactCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} theme={theme} />
      </section>
    );
  }

  if (artDirection === "japanese-editorial") {
    return <EditorialCta cta={cta} contactMethods={contactMethods} theme={theme} ctaStyle={ctaStyle} />;
  }
  if (artDirection === "sensory-immersive") {
    return <ImmersiveCta cta={cta} contactMethods={contactMethods} theme={theme} ctaStyle={ctaStyle} />;
  }
  return <CraftCta cta={cta} contactMethods={contactMethods} theme={theme} ctaStyle={ctaStyle} />;
}
