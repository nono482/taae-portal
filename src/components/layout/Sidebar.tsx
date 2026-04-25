'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { SidebarData } from '@/app/actions/sidebar'

interface NavItem {
  label: string
  href: string
  badge?: number
  badgeColor?: 'red' | 'blue'
}

interface NavGroup {
  group: string
  items: NavItem[]
}

function buildNav(data: SidebarData): NavGroup[] {
  return [
    {
      group: 'メイン',
      items: [
        { label: 'ダッシュボード', href: '/dashboard' },
        {
          label: '経費精算',
          href: '/expenses',
          ...(data.pendingExpenseCount > 0 && { badge: data.pendingExpenseCount, badgeColor: 'red' as const }),
        },
        { label: '給与管理',          href: '/payroll' },
        { label: '業務委託',          href: '/contractors' },
        { label: 'スケジュール',      href: '/schedules' },
        { label: '銀行・入出金',      href: '/banking' },
      ],
    },
    {
      group: '分析・出力',
      items: [
        { label: '財務レポート',      href: '/reports' },
        { label: '会計エクスポート',  href: '/export' },
        {
          label: '通知',
          href: '/notifications',
          ...(data.unreadNotifCount > 0 && { badge: data.unreadNotifCount, badgeColor: 'blue' as const }),
        },
      ],
    },
    {
      group: '管理',
      items: [
        { label: '基本設定',     href: '/settings' },
        { label: 'ユーザー管理', href: '/users' },
      ],
    },
  ]
}

const ROLE_LABEL: Record<string, string> = {
  admin:      '管理者',
  accountant: '経理担当',
  member:     'メンバー',
}

interface Props {
  data: SidebarData
}

export function Sidebar({ data }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const navGroups = buildNav(data)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#1e3a5f] flex flex-col fixed left-0 top-0 bottom-0 z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="text-[15px] font-bold text-white leading-tight">Smart TAYORU</div>
        <div className="text-[10px] text-white/40 mt-0.5 tracking-wide">経営管理システム</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navGroups.map(group => (
          <div key={group.group}>
            <div className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {group.group}
            </div>
            {group.items.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-5 py-2.5 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-[#0f2540] text-white border-r-[3px] border-[#4a9eff]'
                      : 'text-white/70 hover:bg-[#16304f] hover:text-white'
                  )}
                >
                  <span className="flex-1">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span
                      className={cn(
                        'text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                        item.badgeColor === 'red' ? 'bg-red-500' : 'bg-[#4a9eff]'
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
            {data.initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white truncate">
              {data.displayName || '—'}
            </div>
            <div className="text-[10px] text-white/40">
              {ROLE_LABEL[data.role] ?? data.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-[10px] text-white/40 hover:text-white/80 transition-colors"
            title="ログアウト"
          >
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  )
}
