'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import type { NotificationRow } from '@/app/actions/notifications'

const CATEGORY_CFG: Record<string, { label: string; cls: string }> = {
  tax:     { label: '税務',    cls: 'bg-red-50 text-red-700'      },
  expense: { label: '経費',    cls: 'bg-amber-50 text-amber-700'  },
  payroll: { label: '給与',    cls: 'bg-blue-50 text-blue-700'    },
  bank:    { label: '銀行',    cls: 'bg-green-50 text-green-700'  },
  system:  { label: 'システム', cls: 'bg-slate-100 text-slate-500' },
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-300',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}/${mm}/${dd} ${hh}:${min}`
}

interface Props {
  initialNotifs: NotificationRow[]
}

export default function NotificationsClient({ initialNotifs }: Props) {
  const [notifs, setNotifs]           = useState<NotificationRow[]>(initialNotifs)
  const [filter, setFilter]           = useState<'all' | 'unread'>('all')
  const [isPending, startTransition]  = useTransition()

  const unreadCount = notifs.filter(n => !n.is_read).length
  const displayed   = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs

  function markReadLocal(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    startTransition(() => { markNotificationRead(id) })
  }

  function markAllReadLocal() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    startTransition(() => {
      markAllNotificationsRead().then(() => toast.success('すべて既読にしました'))
    })
  }

  const catCfg = (cat: string) => CATEGORY_CFG[cat] ?? CATEGORY_CFG['system']
  const dotCls = (prio: string) => PRIORITY_DOT[prio] ?? 'bg-slate-300'

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold text-[#1a2332]">通知センター</h1>
          {unreadCount > 0 && (
            <span className="text-[11px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllReadLocal}
            disabled={isPending}
            className="text-[12px] font-semibold text-blue-600 hover:underline disabled:opacity-50"
          >
            すべて既読にする
          </button>
        )}
      </div>

      <div className="p-8 max-w-3xl">
        {/* フィルタータブ */}
        <div className="flex items-center gap-1 mb-5 border-b border-[#e2e6ec]">
          {([
            ['all',    'すべて', notifs.length] as const,
            ['unread', '未読',   unreadCount]   as const,
          ]).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                filter === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]'
              )}
            >
              {label}
              <span className={cn(
                'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                filter === key ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-[#8f9db0]'
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* 通知リスト */}
        <div className="space-y-2">
          {displayed.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-[32px] mb-3">🔔</div>
              <div className="text-[14px] font-semibold text-[#5a6a7e] mb-1">
                {filter === 'unread' ? '未読の通知はありません' : '通知はありません'}
              </div>
              <div className="text-[12px] text-[#8f9db0]">
                経費申請・承認など操作があると通知が届きます
              </div>
            </div>
          )}
          {displayed.map(n => (
            <div
              key={n.id}
              className={cn(
                'bg-white border rounded-lg p-5 shadow-sm transition-all',
                !n.is_read
                  ? 'border-l-4 border-l-blue-400 border-r border-t border-b border-[#e2e6ec]'
                  : 'border-[#e2e6ec] opacity-80'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1.5 flex-shrink-0">
                  <span className={cn('w-2 h-2 rounded-full inline-block', dotCls(n.priority))} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', catCfg(n.category).cls)}>
                      {catCfg(n.category).label}
                    </span>
                    {!n.is_read && (
                      <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">NEW</span>
                    )}
                    <span className="text-[11px] text-[#8f9db0] ml-auto">{formatDate(n.created_at)}</span>
                  </div>

                  <div className={cn('text-[14px] font-bold mb-1', !n.is_read ? 'text-[#1a2332]' : 'text-[#5a6a7e]')}>
                    {n.title}
                  </div>
                  <div className="text-[12px] text-[#8f9db0] leading-relaxed">{n.body}</div>

                  <div className="flex items-center gap-3 mt-3">
                    {n.action_label && n.action_href && (
                      <a
                        href={n.action_href}
                        className="text-[12px] font-semibold text-blue-600 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        {n.action_label} →
                      </a>
                    )}
                    {!n.is_read && (
                      <button
                        onClick={() => markReadLocal(n.id)}
                        className="text-[12px] font-semibold text-[#8f9db0] hover:text-[#5a6a7e] transition-colors"
                      >
                        既読にする
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
