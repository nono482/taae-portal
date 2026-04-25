'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getSchedules, createSchedule, updateScheduleStatus, deleteSchedule,
} from '@/app/actions/schedules'
import type { Schedule } from '@/app/actions/schedules'

const SCHEDULE_TYPES = [
  { value: 'tax',     label: '納税・申告' },
  { value: 'payment', label: '支払い' },
  { value: 'report',  label: '報告・提出' },
  { value: 'other',   label: 'その他' },
]

const TYPE_CFG: Record<string, { label: string; cls: string }> = {
  tax:     { label: '納税・申告', cls: 'bg-red-50 text-red-700'     },
  payment: { label: '支払い',    cls: 'bg-amber-50 text-amber-700'  },
  report:  { label: '報告・提出', cls: 'bg-blue-50 text-blue-700'   },
  other:   { label: 'その他',    cls: 'bg-slate-100 text-slate-600' },
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending:    { label: '未対応', cls: 'bg-amber-50 text-amber-700'  },
  in_progress:{ label: '対応中', cls: 'bg-blue-50 text-blue-700'    },
  completed:  { label: '完了',   cls: 'bg-green-50 text-green-700'  },
  skipped:    { label: 'スキップ', cls: 'bg-slate-100 text-slate-500'},
}

function daysUntil(dateStr: string): { label: string; variant: 'overdue' | 'soon' | 'ok' } {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (diff < 0)  return { label: `${Math.abs(diff)}日超過`, variant: 'overdue' }
  if (diff === 0) return { label: '今日期限',                 variant: 'overdue' }
  if (diff <= 7)  return { label: `残り${diff}日`,            variant: 'soon'    }
  return                   { label: `残り${diff}日`,          variant: 'ok'      }
}

// ─── 新規作成モーダル ─────────────────────────────────────
function NewScheduleModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    title: '',
    due_date: new Date().toISOString().slice(0, 10),
    schedule_type: 'tax',
    amount: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = 'タイトルを入力してください'
    if (!form.due_date)     errs.due_date = '期日を選択してください'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    startTransition(async () => {
      const res = await createSchedule({
        title:         form.title.trim(),
        due_date:      form.due_date,
        schedule_type: form.schedule_type,
        amount:        form.amount ? parseInt(form.amount) : null,
        notes:         form.notes || null,
      })
      if (res.error) { toast.error(`エラー: ${res.error}`); return }
      toast.success('スケジュールを追加しました')
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">スケジュールを追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">タイトル *</label>
            <input
              value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="例: 源泉所得税の納付"
              className={cn(
                'w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100',
                errors.title ? 'border-red-400' : 'border-[#e2e6ec]'
              )}
            />
            {errors.title && <p className="text-[11px] text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">期日 *</label>
              <input
                type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:border-blue-400',
                  errors.due_date ? 'border-red-400' : 'border-[#e2e6ec]'
                )}
              />
              {errors.due_date && <p className="text-[11px] text-red-600 mt-1">{errors.due_date}</p>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">種別</label>
              <select
                value={form.schedule_type} onChange={e => set('schedule_type', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400"
              >
                {SCHEDULE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">金額（任意）</label>
            <input
              type="text" inputMode="numeric"
              value={form.amount} onChange={e => set('amount', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="例: 48200"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">メモ（任意）</label>
            <textarea
              value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="備考・詳細など"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors">
              {isPending ? '追加中…' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function SchedulesPage() {
  const [schedules, setSchedules]     = useState<Schedule[]>([])
  const [loading, setLoading]         = useState(true)
  const [showNew, setShowNew]         = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all')
  const [isPending, startTransition]  = useTransition()

  async function loadData() {
    setLoading(true)
    const { data } = await getSchedules()
    setSchedules(data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const filtered = filterStatus === 'all'
    ? schedules
    : schedules.filter(s => s.status === filterStatus)

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      const res = await updateScheduleStatus(id, status)
      if (res.error) toast.error(`エラー: ${res.error}`)
      else toast.success('ステータスを更新しました')
      await loadData()
    })
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`「${title}」を削除しますか？`)) return
    startTransition(async () => {
      const res = await deleteSchedule(id)
      if (res.error) toast.error(`エラー: ${res.error}`)
      else toast.success('削除しました')
      await loadData()
    })
  }

  const overdueCount = schedules.filter(s =>
    s.status !== 'completed' && s.status !== 'skipped' && new Date(s.due_date) < new Date()
  ).length

  return (
    <div>
      {showNew && (
        <NewScheduleModal onClose={() => setShowNew(false)} onSaved={loadData} />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">税務・支払スケジュール</h1>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors"
        >
          ＋ 新規追加
        </button>
      </div>

      <div className="p-8">
        {/* 超過アラート */}
        {overdueCount > 0 && (
          <div className="mb-6 px-5 py-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <span className="text-red-500 text-[18px]">⚠️</span>
            <div>
              <div className="text-[14px] font-bold text-red-700">期限超過が {overdueCount}件 あります</div>
              <div className="text-[12px] text-red-600 mt-0.5">早急に対応してください</div>
            </div>
          </div>
        )}

        {/* フィルタータブ */}
        <div className="flex items-center gap-1 mb-4 border-b border-[#e2e6ec]">
          {([
            ['all', 'すべて'],
            ['pending', '未対応'],
            ['in_progress', '対応中'],
            ['completed', '完了'],
          ] as const).map(([key, label]) => {
            const count = key === 'all' ? schedules.length : schedules.filter(s => s.status === key).length
            return (
              <button
                key={key}
                onClick={() => setFilterStatus(key)}
                className={cn(
                  'px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                  filterStatus === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]'
                )}
              >
                {label}
                <span className={cn(
                  'ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  filterStatus === key ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-[#8f9db0]'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* リスト */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white border border-[#e2e6ec] rounded-lg p-5 h-20" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-[32px] mb-3">📅</div>
            <div className="text-[14px] font-semibold text-[#5a6a7e] mb-1">スケジュールがありません</div>
            <div className="text-[12px] text-[#8f9db0] mb-4">納税・支払い期限などを登録しておくと便利です</div>
            <button
              onClick={() => setShowNew(true)}
              className="text-[13px] font-semibold text-blue-600 hover:underline"
            >
              ＋ 最初のスケジュールを追加
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(s => {
              const days = daysUntil(s.due_date)
              const typeCfg   = TYPE_CFG[s.schedule_type]   ?? TYPE_CFG['other']
              const statusCfg = STATUS_CFG[s.status]         ?? STATUS_CFG['pending']
              const isCompleted = s.status === 'completed' || s.status === 'skipped'

              return (
                <div
                  key={s.id}
                  className={cn(
                    'bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm flex items-start gap-4',
                    days.variant === 'overdue' && !isCompleted && 'border-l-4 border-l-red-400',
                    days.variant === 'soon'    && !isCompleted && 'border-l-4 border-l-amber-400',
                    isCompleted && 'opacity-60'
                  )}
                >
                  {/* 期日インジケーター */}
                  <div className={cn(
                    'flex-shrink-0 w-14 text-center rounded-lg py-2',
                    isCompleted
                      ? 'bg-slate-50'
                      : days.variant === 'overdue' ? 'bg-red-50' : days.variant === 'soon' ? 'bg-amber-50' : 'bg-slate-50'
                  )}>
                    <div className="text-[10px] font-semibold text-[#8f9db0]">
                      {String(s.due_date).slice(5, 7)}月
                    </div>
                    <div className={cn(
                      'text-[20px] font-bold leading-none mt-0.5',
                      isCompleted
                        ? 'text-slate-400'
                        : days.variant === 'overdue' ? 'text-red-600' : days.variant === 'soon' ? 'text-amber-600' : 'text-[#1a2332]'
                    )}>
                      {String(s.due_date).slice(8)}
                    </div>
                  </div>

                  {/* 本文 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', typeCfg.cls)}>
                        {typeCfg.label}
                      </span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusCfg.cls)}>
                        {statusCfg.label}
                      </span>
                      {!isCompleted && (
                        <span className={cn(
                          'text-[10px] font-semibold',
                          days.variant === 'overdue' ? 'text-red-600' : days.variant === 'soon' ? 'text-amber-600' : 'text-[#8f9db0]'
                        )}>
                          {days.label}
                        </span>
                      )}
                    </div>

                    <div className={cn('text-[14px] font-bold', isCompleted ? 'text-[#8f9db0] line-through' : 'text-[#1a2332]')}>
                      {s.title}
                    </div>

                    {s.amount != null && (
                      <div className="text-[12px] text-[#5a6a7e] mt-0.5 font-mono">
                        ¥{Number(s.amount).toLocaleString()}
                      </div>
                    )}

                    {s.notes && (
                      <div className="text-[12px] text-[#8f9db0] mt-1">{s.notes}</div>
                    )}
                  </div>

                  {/* 操作 */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <select
                      value={s.status}
                      onChange={e => handleStatusChange(s.id, e.target.value)}
                      disabled={isPending}
                      className="text-[12px] border border-[#e2e6ec] rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400 disabled:opacity-50"
                    >
                      <option value="pending">未対応</option>
                      <option value="in_progress">対応中</option>
                      <option value="completed">完了</option>
                      <option value="skipped">スキップ</option>
                    </select>
                    <button
                      onClick={() => handleDelete(s.id, s.title)}
                      disabled={isPending}
                      className="text-[12px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
