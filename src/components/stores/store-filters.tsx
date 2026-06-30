'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

const CATEGORIES = ['飲食店', 'カフェ', 'バー', '美容室', 'ネイルサロン', 'マッサージ', 'スパ', 'ホテル', '宿泊施設', '旅館', 'ゲストハウス', '医院', '病院', '歯科', '小売店', 'ジム']
const AREAS = ['那覇市', '浦添市', '宜野湾市', '沖縄市', 'うるま市', '名護市', '恩納村', '読谷村', '北谷町', '豊見城市', '糸満市', '石垣市', '宮古島市']

export function StoreFilters() {
  const router = useRouter()
  const params = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page') // フィルタ変更時はページリセット
    router.push(`/stores?${next.toString()}`)
  }, [params, router])

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* 検索 */}
      <input
        type="text"
        placeholder="店名で検索..."
        defaultValue={params.get('search') ?? ''}
        onChange={(e) => update('search', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40"
      />

      {/* 業種 */}
      <select
        value={params.get('category') ?? ''}
        onChange={(e) => update('category', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">業種 すべて</option>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* エリア */}
      <select
        value={params.get('area') ?? ''}
        onChange={(e) => update('area', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">エリア すべて</option>
        {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      {/* 優先度 */}
      <select
        value={params.get('priority_rank') ?? ''}
        onChange={(e) => update('priority_rank', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">優先度 すべて</option>
        <option value="A">A（高）</option>
        <option value="B">B（中）</option>
        <option value="C">C（低）</option>
      </select>

      {/* HP有無 */}
      <select
        value={params.get('has_website') ?? ''}
        onChange={(e) => update('has_website', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">HP すべて</option>
        <option value="false">HPなし</option>
        <option value="true">HPあり</option>
      </select>

      {/* リセット */}
      {(params.get('search') || params.get('category') || params.get('area') || params.get('priority_rank') || params.get('has_website')) && (
        <button
          onClick={() => router.push('/stores')}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          リセット
        </button>
      )}
    </div>
  )
}
