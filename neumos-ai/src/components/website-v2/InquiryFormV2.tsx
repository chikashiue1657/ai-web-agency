"use client";

import { FormEvent, useState } from "react";
import type { ArtDirection } from "@/lib/engine/v2-design-system";
import type { CafeThemeV2 } from "@/lib/theme-v2";

type SubmitState = "idle" | "sending" | "success" | "error";

export function InquiryFormV2({
  requestId,
  storeName,
  artDirection,
  theme,
}: {
  requestId: string;
  storeName: string;
  artDirection: ArtDirection;
  theme: CafeThemeV2;
}) {
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [startedAt] = useState(() => Date.now());
  const dark = artDirection === "sensory-immersive";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    setState("sending");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      requestId,
      inquiryType: data.get("inquiryType"),
      name: data.get("name"),
      email: data.get("email"),
      phone: data.get("phone"),
      preferredDate: data.get("preferredDate"),
      message: data.get("message"),
      consent: data.get("consent") === "on",
      website: data.get("website"),
      startedAt,
    };

    try {
      const response = await fetch("/api/public/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "送信に失敗しました");
      form.reset();
      setState("success");
      setMessage("送信しました。店舗からのご連絡をお待ちください。");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "送信に失敗しました");
    }
  }

  const inputClass = dark
    ? "w-full rounded-none border border-white/25 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-white focus:ring-2 focus:ring-white/40"
    : "w-full rounded-none border border-stone-300 bg-white px-4 py-3 text-sm text-stone-950 outline-none transition focus:border-stone-800 focus:ring-2 focus:ring-stone-300";
  const labelClass = dark ? "text-white/85" : theme.bodyText;

  return (
    <section className={dark ? "bg-stone-950 text-white" : theme.paperRaisedBg} aria-labelledby="inquiry-heading">
      <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
        <div className={artDirection === "japanese-editorial" ? "max-w-2xl" : "mx-auto max-w-2xl text-center"}>
          <p className={`text-[11px] font-semibold tracking-[0.24em] ${dark ? "text-white/60" : theme.accentText}`}>
            CONTACT FORM
          </p>
          <h2 id="inquiry-heading" className={`mt-4 text-2xl sm:text-3xl ${dark ? "text-white" : theme.bodyText} ${theme.displayFont}`}>
            {storeName}へのご予約・お問い合わせ
          </h2>
          <p className={`mt-4 text-sm leading-7 ${dark ? "text-white/65" : theme.bodyTextSoft}`}>
            ご予約の相談やご質問をこちらから送信できます。メールアドレスまたは電話番号のどちらかをご入力ください。
          </p>
        </div>

        <form onSubmit={submit} className={`mt-10 grid gap-5 sm:grid-cols-2 ${artDirection === "japanese-editorial" ? "max-w-3xl" : "mx-auto max-w-3xl text-left"}`}>
          <label className={`text-sm ${labelClass}`}>
            ご用件
            <select name="inquiryType" className={`${inputClass} mt-2`} defaultValue="reservation">
              <option value="reservation">予約について</option>
              <option value="general">一般のお問い合わせ</option>
            </select>
          </label>
          <label className={`text-sm ${labelClass}`}>
            お名前 <span aria-hidden="true">*</span>
            <input name="name" autoComplete="name" required maxLength={80} className={`${inputClass} mt-2`} />
          </label>
          <label className={`text-sm ${labelClass}`}>
            メールアドレス
            <input name="email" type="email" autoComplete="email" maxLength={254} className={`${inputClass} mt-2`} />
          </label>
          <label className={`text-sm ${labelClass}`}>
            電話番号
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={32} className={`${inputClass} mt-2`} />
          </label>
          <label className={`text-sm ${labelClass}`}>
            ご希望日（任意）
            <input name="preferredDate" type="date" className={`${inputClass} mt-2`} />
          </label>
          <div className="hidden" aria-hidden="true">
            <label>
              ウェブサイト
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className={`text-sm sm:col-span-2 ${labelClass}`}>
            お問い合わせ内容 <span aria-hidden="true">*</span>
            <textarea name="message" required maxLength={1200} rows={6} className={`${inputClass} mt-2 resize-y`} />
          </label>
          <label className={`flex items-start gap-3 text-xs leading-6 sm:col-span-2 ${dark ? "text-white/70" : theme.bodyTextSoft}`}>
            <input name="consent" type="checkbox" required className="mt-1.5 size-4 shrink-0 accent-stone-900" />
            入力した情報が、このお問い合わせへの対応のために利用されることに同意します。
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={state === "sending"}
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-8 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto ${
                dark ? "bg-white text-stone-950 hover:bg-stone-200 focus:ring-white" : `${theme.ctaBg} text-white hover:opacity-90 focus:ring-stone-700`
              }`}
            >
              {state === "sending" ? "送信中…" : "この内容で送信する"}
            </button>
            <p className={`mt-4 min-h-6 text-sm ${state === "error" ? "text-red-500" : dark ? "text-white/75" : theme.bodyText}`} role="status" aria-live="polite">
              {message}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
