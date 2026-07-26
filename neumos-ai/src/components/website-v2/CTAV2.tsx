import type { ContactMethod, WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";

/**
 * 最終CTA。hrefはbrief.realDataに基づき`buildCtaWithRealLinks`/
 * `buildContactMethodsWithRealLinks`が既に確定させた値をそのまま使う
 * （このコンポーネントではリンク生成ロジックに一切触れない）。
 * ページ全体で唯一、明確な行動喚起として中央寄せを使う。
 *
 * `variant`はBrand Director接続用の任意拡張（省略時は既定の"primary"で
 * 従来と完全に同一のマークアップ）。BrandPlan.ctaStrategy.placementが
 * "after-story"の場合のみ、storyの直後にも控えめな"compact"版を追加で
 * 表示する（既存の文末CTAはそのまま残す＝削除しない）。`urgency`は
 * BrandPlan.ctaStrategy.urgencyをそのままボタンの視覚的な強さへ反映する
 * （新しい文言は作らない。捏造した緊急性の煽り文句は追加しない）。
 */
export function CTAV2({
  cta,
  contactMethods,
  theme,
  variant = "primary",
  urgency = "medium",
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
  variant?: "primary" | "compact";
  urgency?: "low" | "medium" | "high";
}) {
  if (variant === "compact") {
    const buttonClass =
      urgency === "high"
        ? `mt-6 inline-flex items-center justify-center rounded-full ${theme.ctaBg} px-8 py-3 text-sm font-medium text-white transition hover:opacity-90 sm:text-base`
        : urgency === "low"
        ? `mt-6 inline-flex w-fit items-center gap-2 border-b ${theme.bodyText} pb-1 text-sm font-medium transition hover:gap-3`
        : `mt-6 inline-flex items-center justify-center rounded-full border ${theme.bodyText} border-current px-8 py-3 text-sm font-medium transition hover:opacity-70 sm:text-base`;

    return (
      <section className={`${theme.paperRaisedBg} px-5 py-16 text-center sm:py-20`}>
        <h2 className={`text-xl ${theme.bodyText} ${theme.displayFont} sm:text-2xl`}>{cta.headline}</h2>
        <a href={cta.href} className={buttonClass}>
          {cta.buttonLabel}
        </a>
      </section>
    );
  }

  return (
    <section id="contact" className={`${theme.ctaBg}`}>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-32 text-center sm:py-40">
        <h2 className={`text-2xl text-white sm:text-3xl ${theme.displayFont}`}>{cta.headline}</h2>
        <p className="mt-4 max-w-md text-sm text-white/80 sm:text-base">{cta.body}</p>

        {/*
          塗りつぶしの目立つボタンをやめ、枠線だけのボタン＋広い余白で
          行動喚起を作る（「ボタンを目立たせない、余白で目立たせる」）。
          白文字・白枠×stone-900は十分なコントラストを確保できる。
        */}
        <a
          href={cta.href}
          className="mt-12 inline-flex items-center justify-center rounded-full border border-white/70 px-9 py-3.5 text-sm font-medium text-white transition hover:bg-white hover:text-stone-950 sm:mt-14 sm:text-base"
        >
          {cta.buttonLabel}
        </a>

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
