'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'ダッシュボード', icon: '◼' },
  { href: '/stores', label: '店舗一覧', icon: '🏪' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-gray-900 min-h-screen flex flex-col">
      <div className="px-5 py-4 border-b border-gray-700">
        <h1 className="text-white font-bold text-sm leading-tight">
          AI集客支援<br />
          <span className="text-gray-400 font-normal text-xs">管理画面</span>
        </h1>
      </div>
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                ${active
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-3 border-t border-gray-700">
        <p className="text-xs text-gray-500">MVP v0.1</p>
      </div>
    </aside>
  )
}
