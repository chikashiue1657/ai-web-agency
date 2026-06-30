import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PriorityBadge, StatusBadge, Badge } from '@/components/ui/badge'
import { StoreActions } from '@/components/stores/store-actions'
import { NotesEditor } from '@/components/stores/notes-editor'
import type { Lead, Proposal, GeneratedSite, ActivityLog } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-100">{title}</h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800">{value ?? <span className="text-gray-300">-</span>}</span>
    </div>
  )
}

const EVENT_LABELS: Record<string, string> = {
  store_imported: '店舗取り込み',
  priority_evaluated: '優先度判定',
  proposal_generated: '提案書生成',
  site_generated: '仮サイト生成',
  note_updated: 'メモ更新',
  status_changed: 'ステータス変更',
  contacted: '接触',
}

export default async function StoreDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: store, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !store) notFound()

  const [leadsRes, proposalsRes, sitesRes, logsRes] = await Promise.all([
    supabase.from('leads').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(1),
    supabase.from('proposals').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('generated_sites').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('activity_logs').select('*').eq('store_id', id).order('created_at', { ascending: false }).limit(20),
  ])

  const lead = leadsRes.data?.[0] as Lead | undefined
  const proposals = (proposalsRes.data ?? []) as Proposal[]
  const sites = (sitesRes.data ?? []) as GeneratedSite[]
  const logs = (logsRes.data ?? []) as ActivityLog[]

  return (
    <div className="p-6 max-w-5xl">
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/stores" className="hover:text-gray-600">店舗一覧</Link>
            <span>›</span>
            <span>{store.name}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{store.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            {store.category && <Badge>{store.category}</Badge>}
            {store.area && <span className="text-sm text-gray-500">{store.area}</span>}
            <PriorityBadge rank={lead?.priority_rank ?? null} />
            <StatusBadge status={lead?.status ?? null} />
          </div>
        </div>
        {/* アクション */}
        <ClientRefreshWrapper>
          <StoreActions store={store} onRefresh={() => {}} />
        </ClientRefreshWrapper>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 基本情報 */}
        <Section title="基本情報">
          <InfoRow label="住所" value={store.address} />
          <InfoRow label="電話" value={store.phone} />
          <InfoRow label="評価" value={store.rating ? `★${store.rating}（${store.review_count}件）` : null} />
          <InfoRow label="写真数" value={store.photo_count > 0 ? `${store.photo_count}枚` : null} />
          <InfoRow label="HP" value={store.has_website ? (
            <a href={store.website_url!} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">{store.website_url}</a>
          ) : <span className="text-red-400 text-xs">なし</span>} />
          <InfoRow label="Instagram" value={store.instagram_url ? (
            <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">{store.instagram_url}</a>
          ) : null} />
          <InfoRow label="Facebook" value={store.facebook_url ? (
            <a href={store.facebook_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs">{store.facebook_url}</a>
          ) : null} />
          <InfoRow label="データソース" value={<Badge variant="muted">{store.source}</Badge>} />
          <InfoRow label="登録日" value={new Date(store.created_at).toLocaleDateString('ja-JP')} />
        </Section>

        {/* AI判定結果 */}
        <Section title="AI優先度判定">
          {lead ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-gray-800">{lead.score}</div>
                <div>
                  <PriorityBadge rank={lead.priority_rank} />
                  <p className="text-xs text-gray-400 mt-0.5">/ 100点</p>
                </div>
              </div>
              {lead.sales_angle && (
                <div className="bg-indigo-50 rounded p-3 text-sm text-indigo-800">
                  💡 {lead.sales_angle}
                </div>
              )}
              {(lead.reasons as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">判定理由</p>
                  <ul className="space-y-1">
                    {(lead.reasons as string[]).map((r, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-green-500 shrink-0">✓</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(lead.risk_flags as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">リスクフラグ</p>
                  <ul className="space-y-1">
                    {(lead.risk_flags as string[]).map((r, i) => (
                      <li key={i} className="text-xs text-amber-700 flex gap-1.5">
                        <span className="shrink-0">⚠</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">未判定（「優先度判定」ボタンを押してください）</p>
          )}
        </Section>

        {/* 提案書 */}
        <Section title={`提案書（${proposals.length}件）`}>
          {proposals.length === 0 ? (
            <p className="text-sm text-gray-400">未生成</p>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => (
                <div key={p.id} className="border border-gray-100 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                  {p.summary && <p className="text-xs text-gray-600 mb-2">{p.summary}</p>}
                  {p.generated_markdown && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-indigo-600 hover:underline">Markdown全文を見る</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-gray-700 bg-gray-50 p-2 rounded max-h-64 overflow-y-auto">
                        {p.generated_markdown}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 仮サイト */}
        <Section title={`仮デモサイト（${sites.length}件）`}>
          {sites.length === 0 ? (
            <p className="text-sm text-gray-400">未生成</p>
          ) : (
            <div className="space-y-2">
              {sites.map((s) => (
                <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded p-2.5">
                  <div>
                    <p className="text-xs font-mono text-gray-600">/{s.slug}</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="muted">{s.theme_type}</Badge>
                      <Badge variant={s.status === 'published' ? 'success' : 'muted'}>{s.status}</Badge>
                    </div>
                  </div>
                  <Link
                    href={`/preview/${s.slug}`}
                    target="_blank"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    プレビュー →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 営業メモ */}
        <Section title="営業メモ">
          <NotesEditor
            storeId={store.id}
            initialNotes={lead?.notes ?? null}
            initialStatus={lead?.status ?? 'new'}
          />
        </Section>

        {/* 活動履歴 */}
        <Section title="活動履歴">
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400">履歴なし</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-3 text-xs">
                  <span className="text-gray-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString('ja-JP')}
                  </span>
                  <span className="text-gray-700">
                    {EVENT_LABELS[log.event_type] ?? log.event_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

// Server Componentの制約回避用ラッパー
function ClientRefreshWrapper({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
