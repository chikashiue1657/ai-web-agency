import type { SiteReadiness } from "@/lib/site-readiness";

const tone = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  "nearly-ready": "border-amber-200 bg-amber-50 text-amber-950",
  "needs-content": "border-rose-200 bg-rose-50 text-rose-950",
} as const;

export function SiteReadinessCard({ readiness }: { readiness: SiteReadiness }) {
  return (
    <section className={`rounded-xl border p-4 ${tone[readiness.level]}`} aria-labelledby="site-readiness-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">販売準備スコア</p><h2 id="site-readiness-heading" className="mt-1 text-lg font-bold">{readiness.label}</h2></div>
        <p className="text-3xl font-black tabular-nums">{readiness.score}<span className="ml-1 text-sm font-medium">/ 100</span></p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70" aria-hidden="true"><div className="h-full rounded-full bg-current" style={{ width: `${readiness.score}%` }} /></div>
      {readiness.nextActions.length > 0 ? (
        <div className="mt-4"><p className="text-sm font-semibold">次にやること</p><ul className="mt-2 grid gap-2 md:grid-cols-3">
          {readiness.nextActions.map((item) => <li key={item.id} className="rounded-lg bg-white/75 p-3 text-sm"><span className="font-bold">{item.label}</span><p className="mt-1 text-xs leading-relaxed opacity-80">{item.detail}</p>{item.actionHref ? <a className="mt-2 inline-block font-semibold underline underline-offset-4" href={item.actionHref}>入力する</a> : null}</li>)}
        </ul></div>
      ) : <p className="mt-3 text-sm">主要な実データが揃っています。最新プレビューを生成し、スマホ表示と予約導線を最終確認してください。</p>}
    </section>
  );
}
