import type { ContactMethod, WebsiteCta } from "@/lib/types";
import type { CafeThemeV2 } from "@/lib/theme-v2";

/**
 * 最終CTA。hrefはbrief.realDataに基づき`buildCtaWithRealLinks`/
 * `buildContactMethodsWithRealLinks`が既に確定させた値をそのまま使う
 * （このコンポーネントではリンク生成ロジックに一切触れない）。
 * ページ全体で唯一、明確な行動喚起として中央寄せを使う。
 */
export function CTAV2({
  cta,
  contactMethods,
  theme,
}: {
  cta: WebsiteCta;
  contactMethods: ContactMethod[];
  theme: CafeThemeV2;
}) {
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
