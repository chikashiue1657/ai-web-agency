import { type ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: number | string
  icon?: ReactNode
  description?: string
  variant?: 'default' | 'a' | 'b' | 'c'
}

const VARIANT_CLASSES = {
  default: 'border-gray-200',
  a: 'border-red-300',
  b: 'border-yellow-300',
  c: 'border-blue-300',
}

export function StatCard({ title, value, icon, description, variant = 'default' }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border ${VARIANT_CLASSES[variant]} p-5 shadow-sm`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
    </div>
  )
}
