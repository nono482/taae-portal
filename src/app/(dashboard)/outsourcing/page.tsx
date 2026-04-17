'use client'

import { useState, useEffect, useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  getContractorsForSelect,
  getOutsourcingInvoices,
  createOutsourcingInvoice,
  updateOutsourcingInvoiceStatus,
  getFinancialSchedules,
  createFinancialSchedule,
  completeFinancialSchedule,
} from '@/app/actions/outsourcing'
import type { ScheduleType } from '@/lib/supabase/types'

// ─── ローカル型 ────────────────────────────────────────────
type InvoiceStatus = 'pending' | 'approved' | 'paid' | 'cancelled'
type ScheduleStatus = 'pending' | 'completed' | 'overdue'

interface ContractorOption {
  id: string
  name: string
  withholding_rate: number
  invoice_transition: boolean
}

interface Invoice {
  id: string
  contractor_id: string
  invoice_date: string
  gross_amount: number
  withholding_tax: number
  transition_deduction: number
  net_payment: number
  status: InvoiceStatus
  paid_at: string | null
  memo: string | null
  contractor?: { id: string; name: string; withholding_rate: number; invoice_transition: boolean } | null
}

interface Schedule {
  id: string
  schedule_type: ScheduleType
  title: string
  due_date: string
  amount: number | null
  related_id: string | null
  related_table: string | null
  status: ScheduleStatus
  memo: string | null
  created_at: string
}

// ─── ステータスチップ ─────────────────────────────────────
function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  const cfg: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
    pending:   { label: '未承認',   cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    approved:  { label: '支払待ち', cls: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500'  },
    paid:      { label: '支払済',   cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
    cancelled: { label: 'キャンセル', cls: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
  }
  const { label, cls, dot } = cfg[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />
      {label}
    </span>
  )
}

function ScheduleStatusChip({ status, dueDate }: { status: ScheduleStatus; dueDate: string }) {
  const today     = new Date().toISOString().slice(0, 10)
  const isOverdue = status === 'pending' && dueDate < today
  const daysLeft  = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000)

  if (status === 'completed') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">完了</span>
  }
  if (isOverdue) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">期限超過</span>
  }
  if (daysLeft <= 7) {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">残{daysLeft}日</span>
  }
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">残{daysLeft}日</span>
}

function ScheduleTypeLabel({ type }: { type: ScheduleType }) {
  const labels: Record<ScheduleType, string> = {
    withholding_tax:  '源泉所得税',
    expense_payment:  '経費支払',
    invoice_payment:  '請求書支払',
    custom:           'カスタム',
  }
  const colors: Record<ScheduleType, string> = {
    withholding_tax:  'bg-purple-50 text-purple-700',
    expense_payment:  'bg-teal-50 text-teal-700',
    invoice_payment:  'bg-blue-50 text-blue-700',
    custom:           'bg-slate-100 text-slate-600',
  }
  return (
    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', colors[type])}>
      {labels[type]}
    </span>
  )
}

// ─── 請求書登録モーダル ────────────────────────────────────
function NewInvoiceModal({
  contractors,
  onClose,
  onSaved,
}: {
  contractors: ContractorOption[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    contractor_id: '',
    invoice_date: new Date().toISOString().slice(0, 10),
    gross_amount: '',
    memo: '',
  })
  const [error, setError] = useState('')

  const selectedContractor = contractors.find(c => c.id === form.contractor_id)
  const grossAmt   = parseInt(form.gross_amount) || 0
  const whRate     = selectedContractor?.withholding_rate ?? 0.1021
  const withholding = Math.floor(grossAmt * whRate)
  const transition  = selectedContractor?.invoice_transition ? Math.floor(withholding * 0.02) : 0
  const netPayment  = grossAmt - withholding + transition

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.contractor_id) { setError('委託先を選択してください'); return }
    if (!grossAmt || grossAmt <= 0) { setError('請求額を入力してください'); return }
    setError('')
    startTransition(async () => {
      const res = await createOutsourcingInvoice({
        contractor_id: form.contractor_id,
        invoice_date:  form.invoice_date,
        gross_amount:  grossAmt,
        memo:          form.memo || undefined,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">請求書を登録</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">委託先 *</label>
            <select
              value={form.contractor_id}
              onChange={e => set('contractor_id', e.target.value)}
              required
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400"
            >
              <option value="">— 選択してください —</option>
              {contractors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">請求日 *</label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={e => set('invoice_date', e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">請求額（税抜）*</label>
              <input
                value={form.gross_amount}
                onChange={e => set('gross_amount', e.target.value.replace(/[^\d]/g, ''))}
                required
                placeholder="500000"
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* 計算プレビュー */}
          {grossAmt > 0 && selectedContractor && (
            <div className="bg-slate-50 border border-[#e2e6ec] rounded-lg p-4 space-y-2">
              <div className="text-[11px] font-bold text-[#5a6a7e] mb-2 uppercase tracking-wide">支払計算プレビュー</div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5a6a7e]">請求額（税抜）</span>
                <span className="font-semibold text-[#1a2332] font-mono">¥{grossAmt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-[#5a6a7e]">源泉徴収税（{(whRate * 100).toFixed(2)}%）</span>
                <span className="font-semibold text-amber-600 font-mono">▲¥{withholding.toLocaleString()}</span>
              </div>
              {transition > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#5a6a7e]">インボイス経過措置控除（2%）</span>
                  <span className="font-semibold text-teal-600 font-mono">+¥{transition.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px] border-t border-[#e2e6ec] pt-2 mt-2">
                <span className="font-bold text-[#1a2332]">お支払額（手取り）</span>
                <span className="font-bold text-blue-700 font-mono text-[15px]">¥{netPayment.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">メモ（任意）</label>
            <textarea
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              rows={2}
              placeholder="備考・補足など"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] resize-none focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isPending ? '登録中…' : '請求書を登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── スケジュール登録モーダル ─────────────────────────────
function NewScheduleModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    schedule_type: 'withholding_tax' as ScheduleType,
    title: '',
    due_date: '',
    amount: '',
    memo: '',
  })
  const [error, setError] = useState('')

  const SCHEDULE_TYPE_OPTIONS: { value: ScheduleType; label: string; hint: string }[] = [
    { value: 'withholding_tax',  label: '源泉所得税納付',   hint: '翌月10日（1月・7月は20日）' },
    { value: 'invoice_payment',  label: '請求書支払い',     hint: '委託先への支払期日' },
    { value: 'expense_payment',  label: '経費精算支払い',   hint: '立替・精算の支払予定日' },
    { value: 'custom',           label: 'カスタム',         hint: '任意のスケジュール' },
  ]

  // 源泉所得税を選んだとき、タイトルを自動補完
  function handleTypeChange(v: ScheduleType) {
    setForm(p => ({
      ...p,
      schedule_type: v,
      title: v === 'withholding_tax'
        ? `${new Date().getFullYear()}年${new Date().getMonth() + 1}月分 源泉所得税納付`
        : p.title,
    }))
  }

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('タイトルを入力してください'); return }
    if (!form.due_date) { setError('期限日を入力してください'); return }
    setError('')
    startTransition(async () => {
      const res = await createFinancialSchedule({
        schedule_type: form.schedule_type,
        title:         form.title.trim(),
        due_date:      form.due_date,
        amount:        form.amount ? parseInt(form.amount) : undefined,
        memo:          form.memo || undefined,
      })
      if (res.error) { setError(res.error); return }
      onSaved()
      onClose()
    })
  }

  const selectedType = SCHEDULE_TYPE_OPTIONS.find(o => o.value === form.schedule_type)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">スケジュールを追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">種別 *</label>
            <select
              value={form.schedule_type}
              onChange={e => handleTypeChange(e.target.value as ScheduleType)}
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400"
            >
              {SCHEDULE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {selectedType && (
              <div className="text-[10px] text-[#8f9db0] mt-1">{selectedType.hint}</div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">タイトル *</label>
            <input
              value={form.title}
              onChange={e => set('title', e.target.value)}
              required
              placeholder="例: 2026年4月分 源泉所得税納付"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">期限日 *</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">金額（任意）</label>
              <input
                value={form.amount}
                onChange={e => set('amount', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="例: 120000"
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">メモ（任意）</label>
            <textarea
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              rows={2}
              placeholder="備考など"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] resize-none focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isPending ? '登録中…' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function OutsourcingPage() {
  const [tab, setTab] = useState<'invoices' | 'schedules'>('invoices')

  // 請求書
  const [contractors, setContractors]   = useState<ContractorOption[]>([])
  const [invoices, setInvoices]         = useState<Invoice[]>([])
  const [loadingInv, setLoadingInv]     = useState(true)
  const [showInvModal, setShowInvModal] = useState(false)
  const [isPending, startTransition]    = useTransition()

  // スケジュール
  const [schedules, setSchedules]           = useState<Schedule[]>([])
  const [loadingSch, setLoadingSch]         = useState(true)
  const [showSchModal, setShowSchModal]     = useState(false)
  const [filterSch, setFilterSch]           = useState<'all' | 'pending' | 'completed'>('all')

  async function loadInvoices() {
    setLoadingInv(true)
    const [invRes, ctRes] = await Promise.all([
      getOutsourcingInvoices(),
      getContractorsForSelect(),
    ])
    setInvoices(invRes.data as Invoice[])
    setContractors(ctRes.data as ContractorOption[])
    setLoadingInv(false)
  }

  async function loadSchedules() {
    setLoadingSch(true)
    const res = await getFinancialSchedules()
    setSchedules(res.data as Schedule[])
    setLoadingSch(false)
  }

  useEffect(() => { loadInvoices(); loadSchedules() }, [])

  function handleApprove(id: string) {
    startTransition(async () => {
      await updateOutsourcingInvoiceStatus(id, 'approved')
      await loadInvoices()
    })
  }
  function handlePay(id: string) {
    startTransition(async () => {
      await updateOutsourcingInvoiceStatus(id, 'paid')
      await loadInvoices()
    })
  }
  function handleCompleteSchedule(id: string) {
    startTransition(async () => {
      await completeFinancialSchedule(id)
      await loadSchedules()
    })
  }

  // KPI計算
  const pendingInvoices     = invoices.filter(i => i.status === 'pending')
  const approvedInvoices    = invoices.filter(i => i.status === 'approved')
  const totalPendingPayment = pendingInvoices.reduce((s, i) => s + i.net_payment, 0)
  const totalApprovedPayment = approvedInvoices.reduce((s, i) => s + i.net_payment, 0)
  const totalWithholding    = invoices
    .filter(i => i.status !== 'cancelled')
    .reduce((s, i) => s + i.withholding_tax, 0)

  // スケジュールフィルター
  const today = new Date().toISOString().slice(0, 10)
  const filteredSchedules = schedules.filter(s => {
    if (filterSch === 'pending')   return s.status === 'pending'
    if (filterSch === 'completed') return s.status === 'completed'
    return true
  }).map(s => ({
    ...s,
    // 期限超過を動的に判定
    status: (s.status === 'pending' && s.due_date < today ? 'overdue' : s.status) as ScheduleStatus,
  }))
  const urgentSchedules = filteredSchedules.filter(s =>
    s.status === 'overdue' ||
    (s.status === 'pending' && Math.ceil((new Date(s.due_date).getTime() - new Date(today).getTime()) / 86400000) <= 7)
  )

  return (
    <div>
      {/* モーダル */}
      {showInvModal && (
        <NewInvoiceModal
          contractors={contractors}
          onClose={() => setShowInvModal(false)}
          onSaved={loadInvoices}
        />
      )}
      {showSchModal && (
        <NewScheduleModal
          onClose={() => setShowSchModal(false)}
          onSaved={loadSchedules}
        />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">業務委託・請求管理</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSchModal(true)}
            className="px-4 py-2 text-[13px] font-semibold text-[#1a2332] bg-white border border-[#e2e6ec] hover:bg-slate-50 rounded-lg transition-colors"
          >
            + スケジュール追加
          </button>
          <button
            onClick={() => setShowInvModal(true)}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors shadow-sm"
          >
            + 請求書を登録
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* KPIカード */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            {
              label:  '未承認の請求書',
              val:    `${pendingInvoices.length}件`,
              sub:    `支払予定 ¥${totalPendingPayment.toLocaleString()}`,
              color:  'text-amber-600',
              border: 'border-l-amber-400',
            },
            {
              label:  '承認済（支払待ち）',
              val:    `${approvedInvoices.length}件`,
              sub:    `¥${totalApprovedPayment.toLocaleString()}`,
              color:  'text-blue-600',
              border: 'border-l-blue-500',
            },
            {
              label:  '源泉徴収税累計',
              val:    `¥${totalWithholding.toLocaleString()}`,
              sub:    '全請求書（キャンセル除く）',
              color:  'text-purple-700',
              border: 'border-l-purple-400',
            },
            {
              label:  '期限迫るスケジュール',
              val:    `${urgentSchedules.length}件`,
              sub:    urgentSchedules.length > 0 ? '要対応あり' : '問題なし',
              color:  urgentSchedules.length > 0 ? 'text-red-600' : 'text-green-600',
              border: urgentSchedules.length > 0 ? 'border-l-red-400' : 'border-l-green-500',
            },
          ].map(c => (
            <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
              <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
              <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
              <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* タブ */}
        <div className="flex items-center gap-1 mb-5 border-b border-[#e2e6ec]">
          {([
            { key: 'invoices',  label: '請求書一覧',     badge: pendingInvoices.length },
            { key: 'schedules', label: 'スケジュール管理', badge: urgentSchedules.length },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]'
              )}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 請求書一覧タブ ── */}
        {tab === 'invoices' && (
          <>
            {loadingInv ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center text-[13px] text-[#8f9db0]">
                データを読み込み中…
              </div>
            ) : invoices.length === 0 ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center">
                <div className="text-[13px] text-[#8f9db0] mb-3">請求書データがありません</div>
                <button
                  onClick={() => setShowInvModal(true)}
                  className="text-[13px] font-semibold text-blue-600 hover:underline"
                >
                  + 最初の請求書を登録する
                </button>
              </div>
            ) : (
              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                      {['委託先', '請求日', '請求額（税抜）', '源泉徴収税', 'お支払額', 'メモ', '状態', '操作'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.4px] whitespace-nowrap last:text-center"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr
                        key={inv.id}
                        className="border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-[13px] font-semibold text-[#1a2332]">
                          {inv.contractor?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#8f9db0] whitespace-nowrap">
                          {inv.invoice_date}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-[#1a2332] font-mono">
                          ¥{inv.gross_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-mono text-amber-600">
                          {inv.withholding_tax > 0 ? `▲¥${inv.withholding_tax.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold text-blue-700 font-mono">
                          ¥{inv.net_payment.toLocaleString()}
                          {inv.transition_deduction > 0 && (
                            <span className="text-[10px] font-normal text-teal-600 ml-1">
                              (措置+¥{inv.transition_deduction.toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#8f9db0] max-w-[160px] truncate">
                          {inv.memo ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusChip status={inv.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(inv.id)}
                              disabled={isPending}
                              className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              承認
                            </button>
                          )}
                          {inv.status === 'approved' && (
                            <button
                              onClick={() => handlePay(inv.id)}
                              disabled={isPending}
                              className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              支払済にする
                            </button>
                          )}
                          {(inv.status === 'paid' || inv.status === 'cancelled') && (
                            <span className="text-[11px] text-[#c0c8d8]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e6ec] flex justify-between items-center">
                  <div className="text-[12px] text-[#8f9db0]">{invoices.length}件</div>
                  <div className="text-[12px] text-[#5a6a7e] space-x-4">
                    <span>
                      合計支払額:
                      <span className="font-bold text-[#1a2332] ml-1">
                        ¥{invoices.reduce((s, i) => s + i.net_payment, 0).toLocaleString()}
                      </span>
                    </span>
                    <span>
                      うち源泉徴収:
                      <span className="font-bold text-amber-600 ml-1">
                        ¥{invoices.reduce((s, i) => s + i.withholding_tax, 0).toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── スケジュール管理タブ ── */}
        {tab === 'schedules' && (
          <>
            {/* フィルター */}
            <div className="flex items-center gap-1 mb-4">
              {([
                { key: 'all',       label: 'すべて' },
                { key: 'pending',   label: '未完了' },
                { key: 'completed', label: '完了済' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterSch(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-semibold rounded-full transition-colors',
                    filterSch === f.key
                      ? 'bg-[#1e3a5f] text-white'
                      : 'bg-white border border-[#e2e6ec] text-[#5a6a7e] hover:bg-slate-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loadingSch ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center text-[13px] text-[#8f9db0]">
                データを読み込み中…
              </div>
            ) : filteredSchedules.length === 0 ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center">
                <div className="text-[13px] text-[#8f9db0] mb-3">スケジュールがありません</div>
                <button
                  onClick={() => setShowSchModal(true)}
                  className="text-[13px] font-semibold text-blue-600 hover:underline"
                >
                  + 最初のスケジュールを追加する
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredSchedules.map(sch => {
                  const isOverdue = sch.status === 'overdue'
                  return (
                    <div
                      key={sch.id}
                      className={cn(
                        'bg-white border rounded-lg px-5 py-4 flex items-center gap-4 shadow-sm',
                        isOverdue
                          ? 'border-red-200 bg-red-50'
                          : sch.status === 'completed'
                          ? 'border-[#e2e6ec] opacity-60'
                          : 'border-[#e2e6ec]'
                      )}
                    >
                      {/* 日付 */}
                      <div className="text-center w-14 flex-shrink-0">
                        <div className={cn(
                          'text-[18px] font-bold leading-none',
                          isOverdue ? 'text-red-600' : 'text-[#1a2332]'
                        )}>
                          {sch.due_date.slice(8)}
                        </div>
                        <div className="text-[10px] text-[#8f9db0] mt-0.5">
                          {sch.due_date.slice(0, 7).replace('-', '/')}
                        </div>
                      </div>

                      {/* 区切り線 */}
                      <div className={cn('w-px h-10 flex-shrink-0', isOverdue ? 'bg-red-200' : 'bg-[#e2e6ec]')} />

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ScheduleTypeLabel type={sch.schedule_type} />
                          <span className={cn(
                            'text-[13px] font-semibold truncate',
                            sch.status === 'completed' ? 'line-through text-[#8f9db0]' : 'text-[#1a2332]'
                          )}>
                            {sch.title}
                          </span>
                        </div>
                        {sch.memo && (
                          <div className="text-[11px] text-[#8f9db0]">{sch.memo}</div>
                        )}
                      </div>

                      {/* 金額 */}
                      {sch.amount != null && (
                        <div className="text-[14px] font-bold text-[#1a2332] font-mono flex-shrink-0">
                          ¥{sch.amount.toLocaleString()}
                        </div>
                      )}

                      {/* ステータス＆ボタン */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <ScheduleStatusChip status={sch.status} dueDate={sch.due_date} />
                        {sch.status !== 'completed' && (
                          <button
                            onClick={() => handleCompleteSchedule(sch.id)}
                            disabled={isPending}
                            className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            完了
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 補足説明 */}
            <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg px-5 py-4">
              <div className="text-[12px] font-bold text-blue-800 mb-2">源泉所得税の納付期限について</div>
              <div className="text-[12px] text-blue-700 space-y-1">
                <div>・原則: 支払月の翌月10日（例：4月分支払い → 5月10日）</div>
                <div>・特例（給与等の支払人員が常時10人未満）: 1〜6月分を7月10日、7〜12月分を翌年1月20日</div>
                <div>・上記スケジュールに「源泉所得税納付」を追加して期限を管理できます</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
