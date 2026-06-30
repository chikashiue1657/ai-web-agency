'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Store } from '@/types'

interface StoreActionsProps {
  store: Store
  onRefresh: () => void
}

export function StoreActions({ store, onRefresh }: StoreActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function runAction(action: string, endpoint: string, body: Record<string, unknown>) {
    setLoading(action)
    setMessage(null)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setMessage(`エラー: ${json.error ?? '不明なエラー'}`)
      } else {
        setMessage(`${action} が完了しました`)
        onRefresh()
      }
    } catch {
      setMessage('通信エラーが発生しました')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          loading={loading === '優先度判定'}
          onClick={() => runAction('優先度判定', '/api/priority', { store_id: store.id, use_llm: false })}
        >
          優先度判定
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={loading === '提案書生成'}
          onClick={() => runAction('提案書生成', '/api/proposals', { store_id: store.id })}
        >
          提案書生成
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={loading === '仮サイト生成'}
          onClick={() => runAction('仮サイト生成', '/api/sites', { store_id: store.id })}
        >
          仮サイト生成
        </Button>
      </div>
      {message && (
        <p className={`text-xs ${message.startsWith('エラー') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
