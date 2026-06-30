/**
 * 店舗詳細（サーバコンポーネント）。
 * 基本情報 / 取得元データ / AI判定 / 営業メモ / 提案書 / 仮サイト / 活動履歴 を表示。
 * 各生成アクションは ActionsPanel（クライアント）と server action 経由で実行。
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepo } from "@/lib/repo";
import {
  Section,
  PriorityBadge,
  StatusBadge,
  YesNo,
  BackLink,
  categoryLabel,
} from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ActionsPanel } from "./actions-panel";
import { saveNotesAction, updateStatusAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: Array<[string, string]> = [
  ["new", "新規"],
  ["contacted", "接触済み"],
  ["in_progress", "商談中"],
  ["won", "受注"],
  ["lost", "失注"],
  ["on_hold", "保留"],
];

const EVENT_LABEL: Record<string, string> = {
  "store.ingested": "店舗取り込み",
  "lead.scored": "優先度判定",
  "proposal.generated": "提案書生成",
  "site.generated": "仮サイト生成",
  "lead.note_updated": "営業メモ更新",
  "lead.status_updated": "ステータス更新",
};

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const detail = await getRepo().getStoreDetail(params.id);
  if (!detail) notFound();
  const { store, lead, proposals, sites, activity } = detail;
  const latestProposal = proposals[0] ?? null;
  const latestSite = sites[0] ?? null;

  return (
    <div className="space-y-4">
      <BackLink href="/stores">店舗一覧へ戻る</BackLink>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {store.name}
            <PriorityBadge rank={lead?.priority_rank} />
          </h1>
          <p className="text-sm text-gray-500">
            {categoryLabel(store.category)} ／ {store.area ?? "-"}
          </p>
        </div>
        <ActionsPanel storeId={store.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <Section title="基本情報">
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <Field label="店名" value={store.name} />
            <Field label="業種" value={categoryLabel(store.category)} />
            <Field label="エリア" value={store.area ?? "-"} />
            <Field label="住所" value={store.address ?? "-"} span />
            <Field label="電話" value={store.phone ?? "-"} />
            <Field label="評価" value={store.rating != null ? String(store.rating) : "-"} />
            <Field label="口コミ数" value={String(store.review_count)} />
            <Field label="写真数" value={String(store.photo_count)} />
            <dt className="text-gray-500">HP</dt>
            <dd className="col-span-2"><YesNo value={store.has_website} /> {store.website_url && (
              <a href={store.website_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline ml-1">リンク</a>
            )}</dd>
            <dt className="text-gray-500">Instagram</dt>
            <dd className="col-span-2"><YesNo value={!!store.instagram_url} /></dd>
            <dt className="text-gray-500">Facebook</dt>
            <dd className="col-span-2"><YesNo value={!!store.facebook_url} /></dd>
            <Field label="取得元" value={store.source ?? "-"} />
          </dl>
        </Section>

        {/* AI判定結果 */}
        <Section title="AI判定結果（優先度）">
          {lead ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <PriorityBadge rank={lead.priority_rank} />
                <span className="font-semibold">スコア: {lead.score ?? "-"}</span>
              </div>
              {lead.sales_angle && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">営業切り口</div>
                  <p>{lead.sales_angle}</p>
                </div>
              )}
              {lead.reasons && lead.reasons.length > 0 && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">判定根拠</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {lead.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lead.risk_flags && lead.risk_flags.length > 0 && (
                <div>
                  <div className="text-gray-500 text-xs mb-0.5">注意点 / 要確認</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-700">
                    {lead.risk_flags.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">未判定です。「優先度を判定」を実行してください。</p>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 営業メモ + ステータス */}
        <Section title="営業メモ / ステータス">
          <form action={updateStatusAction.bind(null, store.id)} className="flex items-end gap-2 mb-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">ステータス</label>
              <select
                name="status"
                defaultValue={lead?.status ?? "new"}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                {STATUS_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">接触手段</label>
              <input
                name="contact_method"
                defaultValue={lead?.contact_method ?? ""}
                placeholder="phone / dm / visit"
                className="border border-gray-300 rounded px-2 py-1 text-sm w-32"
              />
            </div>
            <button className="text-sm px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-800" disabled={!lead}>
              更新
            </button>
          </form>
          <form action={saveNotesAction.bind(null, store.id)}>
            <textarea
              name="notes"
              defaultValue={lead?.notes ?? ""}
              rows={4}
              placeholder={lead ? "営業メモを入力" : "先に優先度判定を実行するとメモが保存できます"}
              disabled={!lead}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button className="mt-2 text-sm px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50" disabled={!lead}>
              メモを保存
            </button>
          </form>
        </Section>

        {/* 仮サイト生成状況 */}
        <Section title="仮デモサイト">
          {latestSite ? (
            <div className="text-sm space-y-2">
              <div>テーマ: <span className="font-medium">{latestSite.theme_type}</span> ／ 言語: {latestSite.language} ／ 状態: {latestSite.status}</div>
              <div>slug: <code className="bg-gray-100 px-1 rounded">{latestSite.slug}</code></div>
              <Link
                href={`/preview/${latestSite.slug}`}
                target="_blank"
                className="inline-block text-sm px-3 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700"
              >
                プレビューを開く →
              </Link>
              {sites.length > 1 && (
                <p className="text-xs text-gray-400">過去生成: {sites.length}件</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">未生成です。「仮サイトを生成」を実行してください。</p>
          )}
        </Section>
      </div>

      {/* 提案書 */}
      <Section title="営業提案書">
        {latestProposal ? (
          <div className="border border-gray-100 rounded p-4 bg-gray-50 max-h-[28rem] overflow-y-auto">
            <Markdown source={latestProposal.generated_markdown ?? ""} />
          </div>
        ) : (
          <p className="text-sm text-gray-400">未生成です。「提案書を生成」を実行してください。</p>
        )}
      </Section>

      {/* 取得元データ */}
      <Section title="取得元データ（raw payload）">
        <pre className="text-xs bg-gray-900 text-gray-100 rounded p-3 overflow-x-auto max-h-64">
          {JSON.stringify(store.raw_payload ?? {}, null, 2)}
        </pre>
      </Section>

      {/* 活動履歴 */}
      <Section title="活動履歴">
        {activity.length > 0 ? (
          <ul className="text-sm divide-y divide-gray-100">
            {activity.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <span>{EVENT_LABEL[a.event_type] ?? a.event_type}</span>
                <span className="text-xs text-gray-400">{a.created_at.replace("T", " ").slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">履歴はまだありません。</p>
        )}
      </Section>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className={span ? "col-span-2" : "col-span-2"}>{value}</dd>
    </>
  );
}
