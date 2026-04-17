'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    group: 'メイン',
    items: [
      { label: 'ダッシュボード', href: '/dashboard' },
      { label: '経費精算',       href: '/expenses',   badge: 7,  badgeColor: 'red' },
      { label: '給与管理',       href: '/payroll' },
      { label: '業務委託',       href: '/contractors', badge: 2, badgeColor: 'blue' },
      { label: '請求・スケジュール', href: '/outsourcing' },
      { label: '銀行・入出金',   href: '/banking' },
    ],
  },
  {
    group: '分析・出力',
    items: [
      { label: '財務レポート',     href: '/reports' },
      { label: '会計エクスポート', href: '/export' },
      { label: '通知',             href: '/notifications' },
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

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

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
        <div className="text-[10px] text-white/40 mt-0.5 tracking-wide">NONO合同会社</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(group => (
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
                  {item.badge && (
                    <span
                      className={cn(
                        'text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                        item.badgeColor === 'red' ? 'bg-red-500' : 'bg-[#4a9eff]'
                      )}
                    >
                      {item.badge}
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
            上
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-white truncate">上村 Kami</div>
            <div className="text-[10px] text-white/40">管理者</div>
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
