'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import type { NotificationRow } from '@/app/actions/notifications'

type NotifCategory = 'tax' | 'expense' | 'payroll' | 'bank' | 'system'
type NotifPriority = 'high' | 'medium' | 'low'

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
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}/${mm}/${dd} ${hh}:${min}`
}

// ─── モックフォールバック（DBに通知がない場合） ───────────
const MOCK_NOTIFS: NotificationRow[] = [
  { id:'m1', category:'tax',     priority:'high',   title:'源泉所得税の納付期限が過ぎています',        body:'2026年4月分の源泉所得税 ¥48,200 の納付期限（4月10日）が過ぎています。早急に手続きをお願いします。',         is_read:false, action_label:'詳細を確認',      action_href:'/reports',   created_at:'2026-04-13T08:00:00Z' },
  { id:'m2', category:'expense', priority:'high',   title:'未承認の経費申請が7件あります',             body:'田中 太郎さん他から経費申請が届いています。合計 ¥124,800 の承認処理が必要です。',                          is_read:false, action_label:'一括承認へ',      action_href:'/expenses',  created_at:'2026-04-13T07:30:00Z' },
  { id:'m3', category:'bank',    priority:'medium', title:'銀行残高が低下しています',                  body:'GMOあおぞら銀行の残高が ¥8,320,000 です。今月の出金予定を考慮すると注意が必要です。',                      is_read:false, action_label:'銀行明細を確認',  action_href:'/banking',   created_at:'2026-04-12T18:00:00Z' },
  { id:'m4', category:'payroll', priority:'medium', title:'給与明細の送信が2名残っています',           body:'4月分の給与明細について、佐藤 健一さん・高橋 美咲さんへの送信がまだ完了していません。',                    is_read:true,  action_label:'給与管理へ',      action_href:'/payroll',   created_at:'2026-04-12T10:00:00Z' },
  { id:'m5', category:'tax',     priority:'medium', title:'消費税中間申告の期限（4月30日）が近づいています', body:'消費税の中間申告・納付期限まで残り17日です。納付額 ¥320,000 の準備をお願いします。',               is_read:true,  action_label:'税務スケジュール', action_href:'/reports',   created_at:'2026-04-11T09:00:00Z' },
  { id:'m6', category:'system',  priority:'low',    title:'Smart TAYORUがアップデートされました',      body:'v1.2.0にアップデートされました。銀行CSV対応が拡充され、PayPay銀行に対応しました。',                       is_read:true,  action_label:null,              action_href:null,         created_at:'2026-04-08T09:00:00Z' },
]

interface Props {
  initialNotifs: NotificationRow[]
}

export default function NotificationsClient({ initialNotifs }: Props) {
  const showMock  = initialNotifs.length === 0
  const [notifs, setNotifs] = useState<NotificationRow[]>(
    showMock ? MOCK_NOTIFS : initialNotifs
  )
  const [filter, setFilter]   = useState<'all' | 'unread'>('all')
  const [isPending, startTransition] = useTransition()

  const unreadCount = notifs.filter(n => !n.is_read).length
  const displayed   = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs

  function markReadLocal(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    if (!showMock) {
      startTransition(() => markNotificationRead(id))
    }
  }

  function markAllReadLocal() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    if (!showMock) {
      startTransition(() => markAllNotificationsRead())
    }
  }

  const catCfg  = (cat: string)      => CATEGORY_CFG[cat] ?? CATEGORY_CFG['system']
  const dotCls  = (prio: string)     => PRIORITY_DOT[prio] ?? 'bg-slate-300'

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
          {showMock && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              デモデータ表示中
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
            <div className="py-16 text-center text-[13px] text-[#8f9db0]">通知はありません</div>
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
