/**
 * 店舗詳細（サーバコンポーネント）。
 * 基本情報 / GoogleMap / 写真 / AI分析 / 営業管理 / 提案書 / 仮サイト /
 * アウトリーチ生成 / 取得元データ / 活動履歴 を表示。
 * 生成・更新系は各クライアントパネル + server action 経由で実行。
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
import { extractPhotoNames, photoProxyUrl } from "@/lib/places/photos";
import { ActionsPanel } from "./actions-panel";
import { StatusFunnel } from "./status-funnel";
import { OutreachPanel } from "./outreach-panel";
import { NeumosPanel } from "./neumos-panel";
import { saveNotesAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  "store.ingested": "店舗取り込み",
  "lead.scored": "優先度判定",
  "proposal.generated": "提案書生成",
  "site.generated": "仮サイト生成",
  "lead.note_updated": "営業メモ更新",
  "lead.status_updated": "ステータス更新",
  "outreach.generated": "営業文面生成",
  "site.generation_requested": "HP生成依頼（ノイモスAI）",
};

export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const detail = await getRepo().getStoreDetail(params.id);
  if (!detail) notFound();
  const { store, lead, proposals, sites, activity, siteRequests } = detail;
  const latestProposal = proposals[0] ?? null;
  const latestSite = sites[0] ?? null;
  const latestSiteRequest = siteRequests[0] ?? null;

  // Google Map（キー不要の埋め込み）: 店名＋住所で位置を表示
  const mapQuery = [store.name, store.address].filter(Boolean).join(" ");
  const openingHours =
    store.opening_hours?.weekday_text ?? store.opening_hours?.raw ?? [];
  const photoNames = extractPhotoNames(store.raw_payload);

  return (
    <div className="space-y-4">
      <BackLink href="/stores">店舗一覧へ戻る</BackLink>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {store.name}
            <PriorityBadge rank={lead?.priority_rank} />
            <StatusBadge status={lead?.status} />
          </h1>
          <p className="text-sm text-gray-500">
            {categoryLabel(store.category)} ／ {store.area ?? "-"}
            {lead?.score != null && <> ／ スコア {lead.score}</>}
          </p>
        </div>
        <ActionsPanel storeId={store.id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <Section title="基本情報">
          <dl className="grid grid-cols-3 gap-y-2 text-sm">
            <Field label="業種" value={categoryLabel(store.category)} />
            <Field label="エリア" value={store.area ?? "-"} />
            <Field label="住所" value={store.address ?? "（不明・要確認）"} />
            <Field label="電話" value={store.phone ?? "-"} />
            <Field label="評価" value={store.rating != null ? String(store.rating) : "-"} />
            <Field label="口コミ数" value={String(store.review_count)} />

            <dt className="text-gray-500">営業時間</dt>
            <dd className="col-span-2">
              {openingHours.length > 0 ? (
                <ul className="space-y-0.5">
                  {openingHours.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-400">（要確認）</span>
              )}
            </dd>

            <dt className="text-gray-500">ホームページ</dt>
            <dd className="col-span-2">
              {store.website_url ? (
                <a href={store.website_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  開く ↗
                </a>
              ) : (
                <YesNo value={false} />
              )}
            </dd>
            <dt className="text-gray-500">Instagram</dt>
            <dd className="col-span-2">
              {store.instagram_url ? (
                <a href={store.instagram_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  開く ↗
                </a>
              ) : (
                <YesNo value={false} />
              )}
            </dd>
            <dt className="text-gray-500">Facebook</dt>
            <dd className="col-span-2">
              {store.facebook_url ? (
                <a href={store.facebook_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  開く ↗
                </a>
              ) : (
                <YesNo value={false} />
              )}
            </dd>
            <Field label="取得元" value={store.source ?? "-"} />
          </dl>
        </Section>

        {/* Google Map */}
        <Section title="地図（Googleマップ）">
          {mapQuery ? (
            <iframe
              title={`${store.name} の地図`}
              className="w-full h-72 rounded border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`}
            />
          ) : (
            <p className="text-sm text-gray-400">住所情報がないため地図を表示できません。</p>
          )}
        </Section>
      </div>

      {/* 写真一覧 */}
      <Section title={`写真一覧（${store.photo_count}枚）`}>
        {photoNames.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {photoNames.map((name) => (
              // Places写真はプロキシ経由（キーを晒さない）。next/imageは外部最適化不要のため素のimg。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={name}
                src={photoProxyUrl(name, 600)}
                alt={`${store.name} の写真`}
                loading="lazy"
                className="w-full h-28 object-cover rounded border border-gray-100 bg-gray-50"
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {store.photo_count > 0
              ? "写真の参照情報が保存されていません（Google Places由来の店舗のみ表示可能）。"
              : "登録された写真がありません。"}
          </p>
        )}
      </Section>

      {/* AI分析（優先度判定） */}
      <Section title="AI分析（優先度判定）">
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

      {/* 営業管理（ステータス・ファネル + メモ） */}
      <Section title="営業管理">
        <div className="space-y-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              営業ステータス
              {lead?.last_contacted_at && (
                <span className="ml-2">最終接触日: {lead.last_contacted_at.slice(0, 10)}</span>
              )}
            </div>
            <StatusFunnel storeId={store.id} current={lead?.status ?? null} disabled={!lead} />
          </div>
          <form action={saveNotesAction.bind(null, store.id)}>
            <div className="text-xs text-gray-500 mb-1">営業メモ</div>
            <textarea
              name="notes"
              defaultValue={lead?.notes ?? ""}
              rows={3}
              placeholder={lead ? "営業メモを入力" : "先に優先度判定を実行するとメモが保存できます"}
              disabled={!lead}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button className="mt-2 text-sm px-3 py-1.5 rounded bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50" disabled={!lead}>
              メモを保存
            </button>
          </form>
        </div>
      </Section>

      {/* AIアウトリーチ文面生成（メール / DM / 電話トーク） */}
      <Section title="AI営業文面生成（メール・DM・電話トーク）">
        <OutreachPanel storeId={store.id} />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 提案書 */}
        <Section title="AI営業提案書">
          {latestProposal ? (
            <div className="border border-gray-100 rounded p-4 bg-gray-50 max-h-[28rem] overflow-y-auto">
              <Markdown source={latestProposal.generated_markdown ?? ""} />
            </div>
          ) : (
            <p className="text-sm text-gray-400">未生成です。「提案書を生成」を実行してください。</p>
          )}
        </Section>

        {/* 仮サイト */}
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

      {/* ノイモスAI連携（HP自動生成）: 営業支援→受注→生成→公開 */}
      <Section title="ホームページ生成（ノイモスAI連携）">
        <NeumosPanel
          storeId={store.id}
          isWon={lead?.status === "won"}
          latestRequest={latestSiteRequest}
        />
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </>
  );
}
