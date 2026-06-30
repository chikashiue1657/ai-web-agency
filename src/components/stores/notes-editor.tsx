'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface NotesEditorProps {
  storeId: string
  initialNotes: string | null
  initialStatus: string | null
}

const STATUS_OPTIONS = [
  { value: 'new', label: '新規' },
  { value: 'contacted', label: '接触済' },
  { value: 'meeting', label: '商談中' },
  { value: 'proposal_sent', label: '提案送付' },
  { value: 'negotiating', label: '交渉中' },
  { value: 'won', label: '受注' },
  { value: 'lost', label: '失注' },
  { value: 'on_hold', label: '保留' },
]

export function NotesEditor({ storeId, initialNotes, initialStatus }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [status, setStatus] = useState(initialStatus ?? 'new')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/stores/${storeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          status,
          last_contacted_at: new Date().toISOString(),
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">営業ステータス</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">営業メモ</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          placeholder="営業メモを入力..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} loading={saving}>保存</Button>
        {saved && <span className="text-xs text-green-600">保存しました</span>}
      </div>
    </div>
  )
}
