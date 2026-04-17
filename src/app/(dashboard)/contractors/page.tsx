'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  getContractors,
  getContractorInvoices,
  createContractor,
  updateInvoiceStatus,
} from '@/app/actions/contractors'

// ─── 型 ──────────────────────────────────────────────────
type InvoiceStatus = 'pending' | 'approved' | 'paid' | 'cancelled'

interface DBContractor {
  id:                  string
  tenant_id:           string
  name:                string
  email:               string
  invoice_number:      string | null
  withholding_rate:    number
  invoice_transition:  boolean
  created_at:          string
}

interface DBInvoice {
  id:                   string
  tenant_id:            string
  contractor_id:        string
  invoice_date:         string
  gross_amount:         number
  withholding_tax:      number
  transition_deduction: number
  net_payment:          number
  status:               InvoiceStatus
  paid_at:              string | null
  memo:                 string | null
  created_at:           string
  contractor:           { id: string; name: string; withholding_rate: number } | null
}

// ─── ユーティリティ ───────────────────────────────────────
function formatPeriod(dateStr: string) {
  const [y, m] = dateStr.split('-')
  return `${y}年${parseInt(m)}月`
}

// ─── ステータスチップ ─────────────────────────────────────
function StatusChip({ status }: { status: InvoiceStatus }) {
  const cfg: Record<InvoiceStatus, { label: string; cls: string; dot: string }> = {
    pending:   { label: '未承認',   cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500'  },
    approved:  { label: '支払待ち', cls: 'bg-blue-50 text-blue-700',   dot: 'bg-blue-500'   },
    paid:      { label: '支払済',   cls: 'bg-green-50 text-green-700', dot: 'bg-green-500'  },
    cancelled: { label: 'キャンセル', cls: 'bg-slate-50 text-slate-500', dot: 'bg-slate-400' },
  }
  const c = cfg[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', c.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {c.label}
    </span>
  )
}

// ─── 委託先カード ─────────────────────────────────────────
function ContractorCard({
  c,
  invoiceCount,
  totalPaid,
  onSelect,
}: {
  c:            DBContractor
  invoiceCount: number
  totalPaid:    number
  onSelect:     () => void
}) {
  return (
    <div
      onClick={onSelect}
      className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm hover:border-blue-300 hover:shadow-md cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[14px] font-bold text-[#1a2332]">{c.name}</div>
          <div className="text-[12px] text-[#8f9db0] mt-0.5">{c.email}</div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
          契約中
        </span>
      </div>
      {c.invoice_number && (
        <div className="text-[11px] text-[#5a6a7e] mb-2">インボイス番号: {c.invoice_number}</div>
      )}
      <div className="border-t border-[#e2e6ec] pt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide">源泉徴収</div>
          <div className={cn('text-[11px] font-semibold', c.withholding_rate > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {c.withholding_rate > 0 ? `要（${(c.withholding_rate * 100).toFixed(2)}%）` : '不要（法人）'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide">経過措置</div>
          <div className="text-[11px] font-semibold text-[#5a6a7e]">
            {c.invoice_transition ? '適用あり' : '適用なし'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide">支払累計</div>
          <div className="text-[13px] font-semibold text-[#5a6a7e]">¥{totalPaid.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-[#8f9db0] uppercase tracking-wide">請求実績</div>
          <div className="text-[11px] font-semibold text-[#5a6a7e]">{invoiceCount}件</div>
        </div>
      </div>
    </div>
  )
}

// ─── 委託先追加モーダル ───────────────────────────────────
function AddContractorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name:               '',
    email:              '',
    invoice_number:     '',
    withholding_rate:   '10.21',
    invoice_transition: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setError('氏名・法人名とメールアドレスは必須です')
      return
    }
    setSaving(true)
    const result = await createContractor({
      name:               form.name.trim(),
      email:              form.email.trim(),
      invoice_number:     form.invoice_number.trim() || undefined,
      withholding_rate:   parseFloat(form.withholding_rate) / 100,
      invoice_transition: form.invoice_transition,
    })
    setSaving(false)
    if (result.error) {
      setError(result.error)
    } else {
      onSaved()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[16px] font-bold text-[#1a2332]">業務委託先を追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-[20px] font-light leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          {[
            { key: 'name'  as const, label: '氏名・法人名', placeholder: '田中 雄介 / 株式会社テック', required: true  },
            { key: 'email' as const, label: 'メールアドレス', placeholder: 'example@email.com',        required: true  },
            { key: 'invoice_number' as const, label: 'インボイス登録番号', placeholder: 'T1234567890123', required: false },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={f.key === 'email' ? 'email' : 'text'}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                required={f.required}
                className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] placeholder-[#8f9db0] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          ))}

          <div>
            <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">源泉徴収率（%）</label>
            <select
              value={form.withholding_rate}
              onChange={e => setForm(prev => ({ ...prev, withholding_rate: e.target.value }))}
              className="w-full border border-[#e2e6ec] rounded-lg px-3 py-2 text-[13px] text-[#1a2332] focus:outline-none focus:border-blue-400"
            >
              <option value="10.21">10.21%（個人・月額100万円以下）</option>
              <option value="20.42">20.42%（個人・月額100万円超）</option>
              <option value="0">0%（法人・源泉不要）</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="invoice_transition"
              checked={form.invoice_transition}
              onChange={e => setForm(prev => ({ ...prev, invoice_transition: e.target.checked }))}
              className="accent-blue-600"
            />
            <label htmlFor="invoice_transition" className="text-[13px] text-[#5a6a7e]">
              インボイス経過措置を適用する（仕入税額控除の経過措置）
            </label>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 border-t border-[#e2e6ec] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? '保存中…' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 委託先詳細モーダル ───────────────────────────────────
function ContractorDetailModal({
  c,
  invoiceCount,
  totalPaid,
  onClose,
}: {
  c:            DBContractor
  invoiceCount: number
  totalPaid:    number
  onClose:      () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div>
            <div className="text-[16px] font-bold text-[#1a2332]">{c.name}</div>
            <div className="text-[12px] text-[#8f9db0]">{c.email}</div>
          </div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-[20px] font-light leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {[
            ['メールアドレス',    c.email],
            ['インボイス登録番号', c.invoice_number ?? '未登録'],
            ['源泉徴収率',        c.withholding_rate > 0 ? `${(c.withholding_rate * 100).toFixed(2)}%` : '不要（法人）'],
            ['経過措置',          c.invoice_transition ? '適用あり' : '適用なし'],
            ['支払累計',          `¥${totalPaid.toLocaleString()}`],
            ['請求実績',          `${invoiceCount}件`],
            ['登録日',            c.created_at.slice(0, 10)],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-[12px] font-semibold text-[#8f9db0]">{label}</span>
              <span className="text-[13px] font-semibold text-[#1a2332]">{val}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-[#e2e6ec] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function ContractorsPage() {
  const [tab, setTab]                             = useState<'contractors' | 'invoices'>('invoices')
  const [contractors, setContractors]             = useState<DBContractor[]>([])
  const [invoices, setInvoices]                   = useState<DBInvoice[]>([])
  const [loading, setLoading]                     = useState(true)
  const [selectedContractor, setSelectedContractor] = useState<DBContractor | null>(null)
  const [showAddModal, setShowAddModal]           = useState(false)
  const [actionPending, setActionPending]         = useState<string | null>(null)
  const [toast, setToast]                         = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── データ読み込み ──────────────────────────────────────
  const loadData = useCallback(async () => {
    const [cResult, iResult] = await Promise.all([
      getContractors(),
      getContractorInvoices(),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setContractors((cResult.data as any[]) ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setInvoices((iResult.data as any[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── 請求書ステータス更新 ──────────────────────────────
  async function handleStatusChange(invoiceId: string, status: 'approved' | 'paid' | 'cancelled') {
    setActionPending(invoiceId)
    const result = await updateInvoiceStatus(invoiceId, status)
    setActionPending(null)
    if (result.error) {
      showToast(`エラー: ${result.error}`)
    } else {
      const labels: Record<string, string> = { approved: '承認', paid: '支払済', cancelled: 'キャンセル' }
      showToast(`請求書を「${labels[status]}」に更新しました`)
      await loadData()
    }
  }

  // ── 集計 ────────────────────────────────────────────
  const pendingInvoices  = invoices.filter(i => i.status === 'pending')
  const pendingTotal     = pendingInvoices.reduce((s, i) => s + i.net_payment, 0)
  const monthlyTotal     = invoices
    .filter(i => {
      const thisMonth = new Date().toISOString().slice(0, 7)
      return i.invoice_date.startsWith(thisMonth)
    })
    .reduce((s, i) => s + i.gross_amount, 0)
  const withholdingTotal = invoices
    .filter(i => i.status === 'approved' || i.status === 'paid')
    .reduce((s, i) => s + i.withholding_tax, 0)

  // 委託先ごとの集計
  function getContractorStats(contractorId: string) {
    const invs = invoices.filter(i => i.contractor_id === contractorId)
    return {
      invoiceCount: invs.length,
      totalPaid:    invs.filter(i => i.status === 'paid').reduce((s, i) => s + i.net_payment, 0),
    }
  }

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">業務委託管理</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors shadow-sm"
        >
          + 業務委託先を追加
        </button>
      </div>

      <div className="p-8">
        {/* KPI */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm border-l-slate-200 animate-pulse">
                <div className="h-3 w-24 bg-slate-100 rounded mb-2" />
                <div className="h-6 w-20 bg-slate-100 rounded" />
              </div>
            ))
          ) : (
            [
              { label: '契約中の委託先',     val: `${contractors.length}社／名`,         color: 'text-[#1a2332]', border: 'border-l-blue-600'  },
              { label: '今月の未払い請求',   val: `¥${pendingTotal.toLocaleString()}`,    color: 'text-amber-600', border: 'border-l-amber-400' },
              { label: '今月の請求合計',     val: `¥${monthlyTotal.toLocaleString()}`,    color: 'text-[#1a2332]', border: 'border-l-green-500' },
              { label: '源泉徴収累計',       val: `¥${withholdingTotal.toLocaleString()}`, color: 'text-[#5a6a7e]', border: 'border-l-slate-400' },
            ].map(c => (
              <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
                <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
                <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
              </div>
            ))
          )}
        </div>

        {/* タブ */}
        <div className="flex items-center gap-1 mb-5 border-b border-[#e2e6ec]">
          {([
            { key: 'invoices',    label: '請求書一覧',   badge: pendingInvoices.length },
            { key: 'contractors', label: '委託先マスタ', badge: 0 },
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

        {/* 請求書一覧 */}
        {tab === 'invoices' && (
          loading ? (
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-8 text-center">
              <div className="text-[13px] text-[#8f9db0]">読み込み中…</div>
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-12 text-center">
              <div className="text-[14px] font-semibold text-[#1a2332] mb-1">請求書がありません</div>
              <div className="text-[12px] text-[#8f9db0]">外注管理ページから請求書を作成してください</div>
            </div>
          ) : (
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                    {['委託先', '対象月', '請求額（税抜）', '源泉徴収税額', '支払額（手取）', '発行日', '状態', '操作'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.4px] whitespace-nowrap last:text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="border-b border-[#e2e6ec] last:border-0 transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 text-[13px] font-semibold text-[#1a2332]">
                        {inv.contractor?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#5a6a7e]">{formatPeriod(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[#1a2332] font-mono">¥{inv.gross_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[13px] text-amber-600 font-mono">
                        {inv.withholding_tax > 0 ? `▲¥${inv.withholding_tax.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold text-blue-700 font-mono">¥{inv.net_payment.toLocaleString()}</td>
                      <td className="px-4 py-3 text-[12px] text-[#8f9db0] whitespace-nowrap">{inv.invoice_date}</td>
                      <td className="px-4 py-3"><StatusChip status={inv.status} /></td>
                      <td className="px-4 py-3 text-center">
                        {actionPending === inv.id ? (
                          <span className="text-[11px] text-[#8f9db0]">処理中…</span>
                        ) : inv.status === 'pending' ? (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'approved')}
                            className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors"
                          >
                            承認
                          </button>
                        ) : inv.status === 'approved' ? (
                          <button
                            onClick={() => handleStatusChange(inv.id, 'paid')}
                            className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded transition-colors"
                          >
                            支払済にする
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#c0c8d8]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-slate-50 border-t border-[#e2e6ec] flex justify-between items-center">
                <div className="text-[12px] text-[#8f9db0]">{invoices.length}件</div>
                <div className="text-[12px] text-[#5a6a7e]">
                  合計支払額:
                  <span className="font-bold text-[#1a2332] ml-1">
                    ¥{invoices.reduce((s, i) => s + i.net_payment, 0).toLocaleString()}
                  </span>
                  　うち源泉徴収:
                  <span className="font-bold text-amber-600 ml-1">
                    ¥{invoices.reduce((s, i) => s + i.withholding_tax, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {/* 委託先マスタ */}
        {tab === 'contractors' && (
          loading ? (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-[#e2e6ec] rounded-lg p-5 shadow-sm animate-pulse">
                  <div className="h-4 w-24 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-32 bg-slate-100 rounded mb-4" />
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-8 bg-slate-100 rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : contractors.length === 0 ? (
            <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm p-12 text-center">
              <div className="text-[14px] font-semibold text-[#1a2332] mb-1">委託先が登録されていません</div>
              <div className="text-[12px] text-[#8f9db0] mb-4">「業務委託先を追加」から登録してください</div>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors"
              >
                + 業務委託先を追加
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {contractors.map(c => {
                const stats = getContractorStats(c.id)
                return (
                  <ContractorCard
                    key={c.id}
                    c={c}
                    invoiceCount={stats.invoiceCount}
                    totalPaid={stats.totalPaid}
                    onSelect={() => setSelectedContractor(c)}
                  />
                )
              })}
            </div>
          )
        )}
      </div>

      {/* 委託先追加モーダル */}
      {showAddModal && (
        <AddContractorModal
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            showToast('委託先を登録しました')
            await loadData()
          }}
        />
      )}

      {/* 委託先詳細モーダル */}
      {selectedContractor && (
        <ContractorDetailModal
          c={selectedContractor}
          invoiceCount={getContractorStats(selectedContractor.id).invoiceCount}
          totalPaid={getContractorStats(selectedContractor.id).totalPaid}
          onClose={() => setSelectedContractor(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1a2332] text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
