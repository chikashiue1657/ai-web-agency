import { type ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const VARIANT_CLASSES: Record<Variant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  muted: 'bg-gray-50 text-gray-400',
}

interface BadgeProps {
  children: ReactNode
  variant?: Variant
  className?: string
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

export function PriorityBadge({ rank }: { rank: string | null }) {
  if (!rank) return <Badge variant="muted">未判定</Badge>
  const map: Record<string, Variant> = { A: 'danger', B: 'warning', C: 'info' }
  return <Badge variant={map[rank] ?? 'default'}>{rank}</Badge>
}

export function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; variant: Variant }> = {
    new: { label: '新規', variant: 'info' },
    contacted: { label: '接触済', variant: 'default' },
    meeting: { label: '商談中', variant: 'warning' },
    proposal_sent: { label: '提案送付', variant: 'warning' },
    negotiating: { label: '交渉中', variant: 'warning' },
    won: { label: '受注', variant: 'success' },
    lost: { label: '失注', variant: 'danger' },
    on_hold: { label: '保留', variant: 'muted' },
  }
  const s = status ? map[status] : null
  if (!s) return <Badge variant="muted">未設定</Badge>
  return <Badge variant={s.variant}>{s.label}</Badge>
}
