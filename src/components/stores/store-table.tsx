import Link from 'next/link'
import { PriorityBadge, StatusBadge, Badge } from '@/components/ui/badge'
import type { StoreWithLead } from '@/types'

interface StoreTableProps {
  stores: StoreWithLead[]
}

export function StoreTable({ stores }: StoreTableProps) {
  if (stores.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        該当する店舗が見つかりません
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">店名</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">業種</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">エリア</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">評価</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">口コミ</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">HP</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">SNS</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">優先度</th>
            <th className="text-center px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">スコア</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">ステータス</th>
            <th className="text-left px-4 py-2.5 font-medium text-gray-600 whitespace-nowrap">最終接触</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stores.map((store) => (
            <tr key={store.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/stores/${store.id}`}
                  className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  {store.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">
                {store.category ? (
                  <Badge>{store.category}</Badge>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{store.area ?? '-'}</td>
              <td className="px-4 py-3 text-center">
                {store.rating ? (
                  <span className="font-medium text-amber-600">★{store.rating}</span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {store.review_count > 0 ? store.review_count.toLocaleString() : '-'}
              </td>
              <td className="px-4 py-3 text-center">
                {store.has_website ? (
                  <span className="text-green-600 font-medium">✓</span>
                ) : (
                  <span className="text-red-400">✗</span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs space-x-0.5">
                  {store.instagram_url && <span title="Instagram">📷</span>}
                  {store.facebook_url && <span title="Facebook">🔵</span>}
                  {!store.instagram_url && !store.facebook_url && <span className="text-gray-300">-</span>}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <PriorityBadge rank={store.lead?.priority_rank ?? null} />
              </td>
              <td className="px-4 py-3 text-center">
                {store.lead?.score != null ? (
                  <span className="font-mono text-xs text-gray-700">{store.lead.score}</span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={store.lead?.status ?? null} />
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                {store.lead?.last_contacted_at
                  ? new Date(store.lead.last_contacted_at).toLocaleDateString('ja-JP')
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
