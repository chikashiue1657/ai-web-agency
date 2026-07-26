import type { ContactMethod, WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";
import type { CtaStyle } from "@/lib/engine/v2-design-system";

/**
 * 最終CTA。hrefはbrief.realDataに基づき`buildCtaWithRealLinks`/
 * `buildContactMethodsWithRealLinks`が既に確定させた値をそのまま使う
 * （このコンポーネントではリンク生成ロジックに一切触れない）。
 * ページ全体で唯一、明確な行動喚起として中央寄せを使う。
 *
 * `ctaStyle`はBrandPlan.ctaStrategy.urgency由来（省略時は"outline-minimal"で
 * 従来と同一の見た目）。新しい訴求文言は一切作らない（ボタンの視覚的な強さ
 * だけを変える。捏造した緊急性の煽り文句は追加しない）。
 *
 * `variant`はBrand Director接続用の任意拡張（省略時は既定の"primary"）。
 * BrandPlan.ctaStrategy.placementが"after-story"の場合のみ、storyの直後にも
 * 控えめな"compact"版を追加で表示する（既存の文末CTAはそのまま残す＝削除しない）。
 */
function PrimaryCtaButton({ href, label, ctaStyle }: { href: string; label: string; ctaStyle: CtaStyle }) {
  if (ctaStyle === "text-link") {
    return (
      <a
        href={href}
        className="mt-12 inline-flex w-fit items-center gap-2 border-b border-white/70 pb-1 text-sm font-medium text-white transition hover:gap-3 hover:border-white sm:mt-14 sm:text-base"
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
        className="mt-12 inline-flex items-center justify-center rounded-full bg-white px-10 py-4 text-sm font-semibold text-stone-950 transition hover:bg-white/90 sm:mt-14 sm:text-base"
      >
        {label}
      </a>
    );
  }
  // "outline-minimal"（既定）: このデザイン刷新前からの見た目と同一。
  return (
    <a
      href={href}
      className="mt-12 inline-flex items-center justify-center rounded-full border border-white/70 px-9 py-3.5 text-sm font-medium text-white transition hover:bg-white hover:text-stone-950 sm:mt-14 sm:text-base"
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
        className={`mt-6 inline-flex items-center justify-center rounded-full ${theme.ctaBg} px-8 py-3 text-sm font-medium text-white transition hover:opacity-90 sm:text-base`}
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

export function CTAV2({
  cta,
  contactMethods,
  theme,
  variant = "primary",
  ctaStyle = "outline-minimal",
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  variant?: "primary" | "compact";
  ctaStyle?: CtaStyle;
}) {
  if (variant === "compact") {
    return (
      <section className={`${theme.paperRaisedBg} px-5 py-16 text-center sm:py-20`}>
        <h2 className={`text-xl ${theme.bodyText} ${theme.displayFont} sm:text-2xl`}>{cta.headline}</h2>
        <CompactCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} theme={theme} />
      </section>
    );
  }

  return (
    <section id="contact" className={`${theme.ctaBg}`}>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center sm:py-40">
        <h2 className={`text-2xl text-white sm:text-3xl ${theme.displayFont}`}>{cta.headline}</h2>
        <p className="mt-4 max-w-md text-sm text-white/80 sm:text-base">{cta.body}</p>

        <PrimaryCtaButton href={cta.href} label={cta.buttonLabel} ctaStyle={ctaStyle} />

        {contactMethods.length > 0 && (
          <ul className="mt-9 flex flex-wrap items-center justify-center gap-3">
            {contactMethods.map((method) =>
              method.href ? (
                <li key={method.label}>
                  <a
                    href={method.href}
                    target={method.href.startsWith("http") ? "_blank" : undefined}
                    rel={method.href.startsWith("http") ? "noreferrer" : undefined}
                    className="inline-block rounded-full border border-white/25 px-4 py-1.5 text-xs font-medium text-white/85 transition hover:bg-white/10 sm:text-sm"
                  >
                    {method.label}
                  </a>
                </li>
              ) : (
                <li
                  key={method.label}
                  className="rounded-full border border-white/25 px-4 py-1.5 text-xs font-medium text-white/85 sm:text-sm"
                >
                  {method.label}
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
