'use client'

import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getExpenses, getExpenseCategories,
  createExpense, approveExpense, rejectExpense, bulkApproveExpenses,
} from '@/app/actions/expenses'

type Status = 'pending' | 'approved' | 'rejected'

interface Expense {
  id: string
  vendor_name: string
  amount: number
  tax_amount: number
  expense_date: string
  status: Status
  source: string
  memo?: string | null
  ocr_confidence?: number | null
  category?: { name: string; account_code: string } | null
  submitter?: { display_name: string } | null
}
interface Category { id: string; name: string; account_code: string }

const PAGE_SIZE = 20

// ─── ステータスチップ ─────────────────────────────────────
function StatusChip({ status }: { status: Status }) {
  const cfg = {
    pending:  { label: '未承認', cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    approved: { label: '承認済', cls: 'bg-green-50 text-green-700', dot: 'bg-green-500' },
    rejected: { label: '却下',   cls: 'bg-red-50 text-red-600',     dot: 'bg-red-500'   },
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full', cfg.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[#8f9db0] w-7 text-right">{pct}%</span>
    </div>
  )
}

// ─── 新規経費入力モーダル ─────────────────────────────────
function NewExpenseModal({
  categories, onClose, onSaved,
}: {
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    vendor_name: '', amount: '', expense_date: new Date().toISOString().slice(0, 10),
    category_id: '', source: 'web', memo: '',
  })
  const [error, setError] = useState('')

  const taxAmt = form.amount ? Math.round(parseInt(form.amount) * 10 / 110) : 0
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vendor_name.trim()) { setError('支払先を入力してください'); return }
    if (!form.amount || parseInt(form.amount) <= 0) { setError('金額を入力してください'); return }
    setError('')
    startTransition(async () => {
      const res = await createExpense({
        vendor_name:  form.vendor_name.trim(),
        amount:       parseInt(form.amount),
        tax_amount:   taxAmt,
        expense_date: form.expense_date,
        category_id:  form.category_id || null,
        source:       form.source,
        memo:         form.memo || undefined,
      })
      if (res.error) { setError(res.error); return }
      toast.success('経費を登録しました')
      onSaved()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">経費を新規登録</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">支払先 *</label>
            <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)}
              placeholder="例: セブンイレブン 渋谷店"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">金額（税込）*</label>
              <input
                type="text" inputMode="numeric"
                value={form.amount} onChange={e => set('amount', e.target.value.replace(/[^\d]/g, ''))}
                placeholder="1000"
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
              {form.amount && <div className="text-[10px] text-[#8f9db0] mt-1">うち消費税 ¥{taxAmt.toLocaleString()}</div>}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">経費日 *</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">勘定科目</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400">
                <option value="">— 未選択 —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">入力元</label>
              <select value={form.source} onChange={e => set('source', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400">
                <option value="web">Web</option>
                <option value="manual">手動入力</option>
                <option value="line">LINE</option>
                <option value="slack">Slack</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">メモ（任意）</label>
            <textarea value={form.memo} onChange={e => set('memo', e.target.value)} rows={2}
              placeholder="備考・詳細など"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors">
              {isPending ? '登録中…' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function ExpensesPage() {
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [categories, setCategories]     = useState<Category[]>([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<'all' | Status>('all')
  const [searchQuery, setSearchQuery]   = useState('')
  const [currentPage, setCurrentPage]   = useState(1)
  const [bulkMode, setBulkMode]         = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [isPending, startTransition]    = useTransition()

  async function loadData() {
    setLoading(true)
    const [expRes, catRes] = await Promise.all([getExpenses(), getExpenseCategories()])
    setExpenses(expRes.data as Expense[])
    setCategories(catRes.data as Category[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // フィルタ＋検索
  const filtered = expenses.filter(e => {
    const statusOk = filterStatus === 'all' || e.status === filterStatus
    const q = searchQuery.trim().toLowerCase()
    const searchOk = !q || e.vendor_name.toLowerCase().includes(q) || (e.category?.name ?? '').toLowerCase().includes(q)
    return statusOk && searchOk
  })

  const pendingList  = filtered.filter(e => e.status === 'pending')
  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page         = Math.min(currentPage, totalPages)
  const paginated    = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function onFilterChange(f: 'all' | Status) { setFilterStatus(f); setCurrentPage(1) }
  function onSearchChange(q: string)         { setSearchQuery(q);   setCurrentPage(1) }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }
  function toggleAll() {
    setSelected(prev =>
      prev.size === pendingList.length ? new Set() : new Set(pendingList.map(e => e.id))
    )
  }

  function handleApprove(id: string) {
    startTransition(async () => {
      const res = await approveExpense(id)
      if (res.error) toast.error(`承認エラー: ${res.error}`)
      else toast.success('承認しました')
      await loadData()
    })
  }
  function handleReject(id: string) {
    startTransition(async () => {
      const res = await rejectExpense(id)
      if (res.error) toast.error(`却下エラー: ${res.error}`)
      else toast.warning('却下しました')
      await loadData()
    })
  }
  function handleBulkApprove() {
    const ids = Array.from(selected)
    startTransition(async () => {
      const res = await bulkApproveExpenses(ids)
      if (res.error) toast.error(`一括承認エラー: ${res.error}`)
      else toast.success(`${ids.length}件を一括承認しました`)
      setSelected(new Set()); setBulkMode(false)
      await loadData()
    })
  }

  const totalPendingAmt = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0)
  const selectedAmt     = expenses.filter(e => selected.has(e.id)).reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      {showNewModal && (
        <NewExpenseModal
          categories={categories}
          onClose={() => setShowNewModal(false)}
          onSaved={loadData}
        />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-[16px] font-bold text-[#1a2332]">経費精算</h1>
        <div className="flex items-center gap-3">
          {bulkMode && selected.size > 0 && (
            <span className="text-[12px] text-[#5a6a7e]">{selected.size}件選択中 — 合計 ¥{selectedAmt.toLocaleString()}</span>
          )}
          <button onClick={() => setShowNewModal(true)}
            className="px-4 py-2 text-[13px] font-semibold text-[#1a2332] bg-white border border-[#e2e6ec] hover:bg-slate-50 rounded-lg transition-colors">
            ＋ 新規経費
          </button>
          {bulkMode ? (
            <>
              <button onClick={() => { setBulkMode(false); setSelected(new Set()) }}
                className="px-4 py-2 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
                キャンセル
              </button>
              <button onClick={handleBulkApprove} disabled={selected.size === 0 || isPending}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-lg transition-colors">
                {selected.size}件を承認
              </button>
            </>
          ) : (
            <button onClick={() => setBulkMode(true)}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors">
              一括承認モード
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        {/* サマリーカード */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            { label: '未承認',   val: expenses.filter(e=>e.status==='pending').length,   sub: `¥${totalPendingAmt.toLocaleString()}`,  color: 'text-amber-600', border: 'border-l-amber-400' },
            { label: '承認済',   val: expenses.filter(e=>e.status==='approved').length,  sub: `¥${expenses.filter(e=>e.status==='approved').reduce((s,e)=>s+e.amount,0).toLocaleString()}`, color: 'text-green-600', border: 'border-l-green-500' },
            { label: '却下',     val: expenses.filter(e=>e.status==='rejected').length,  sub: '要確認', color: 'text-red-500', border: 'border-l-red-400' },
            { label: '今月合計', val: `¥${expenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}`, sub: `${expenses.length}件`, color: 'text-[#1a2332]', border: 'border-l-blue-600' },
          ].map(c => (
            <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
              <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
              <div className={cn('text-[22px] font-bold', c.color)}>{c.val}</div>
              <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* 一括承認バナー */}
        {bulkMode && (
          <div className="mb-5 px-5 py-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="text-[13px] text-blue-800">
              <strong className="font-bold">一括承認モード</strong> — 承認する経費にチェックを入れて「承認」ボタンを押してください
            </div>
            <button onClick={toggleAll} className="text-[12px] font-semibold text-blue-600 hover:underline">
              {selected.size === pendingList.length ? 'すべて解除' : 'すべて選択'}
            </button>
          </div>
        )}

        {/* 検索バー + フィルタータブ */}
        <div className="flex items-end gap-4 mb-1">
          <div className="flex items-center gap-1 border-b border-[#e2e6ec] flex-1">
            {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
              const label = { all: 'すべて', pending: '未承認', approved: '承認済', rejected: '却下' }[f]
              const count = f === 'all' ? expenses.length : expenses.filter(e => e.status === f).length
              return (
                <button key={f} onClick={() => onFilterChange(f)}
                  className={cn('px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors -mb-px',
                    filterStatus === f ? 'border-blue-600 text-blue-600' : 'border-transparent text-[#5a6a7e] hover:text-[#1a2332]')}>
                  {label}
                  <span className={cn('ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    filterStatus === f ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-[#8f9db0]')}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mb-1">
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="支払先・科目を検索…"
              className="w-56 px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
        </div>

        {/* テーブル */}
        {loading ? (
          <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center text-[13px] text-[#8f9db0]">
            データを読み込み中…
          </div>
        ) : (
          <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                  {bulkMode && <th className="px-4 py-2.5 w-10">
                    <input type="checkbox" checked={selected.size === pendingList.length && pendingList.length > 0}
                      onChange={toggleAll} className="w-4 h-4 accent-blue-600" />
                  </th>}
                  {['支払先','勘定科目','申請者','日付','入力元','OCR精度','金額（税込）','状態','操作'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.5px] whitespace-nowrap last:text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(e => (
                  <tr key={e.id} className={cn('border-b border-[#e2e6ec] last:border-0 transition-colors',
                    selected.has(e.id) ? 'bg-blue-50' : 'hover:bg-slate-50')}>
                    {bulkMode && (
                      <td className="px-4 py-3">
                        {e.status === 'pending' && (
                          <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)}
                            className="w-4 h-4 accent-blue-600" />
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#1a2332]">{e.vendor_name}</div>
                      {e.memo && <div className="text-[11px] text-[#8f9db0] mt-0.5">{e.memo}</div>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#5a6a7e]">{e.category?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-[#5a6a7e]">{e.submitter?.display_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-[#8f9db0] whitespace-nowrap">
                      {String(e.expense_date).slice(5).replace('-', '/')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                        {e.source?.toUpperCase() ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 w-28">
                      {e.ocr_confidence != null
                        ? <ConfidenceBar value={e.ocr_confidence} />
                        : <span className="text-[11px] text-[#c0c8d8]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-[13px] font-bold text-[#1a2332] font-mono">¥{Number(e.amount).toLocaleString()}</div>
                      <div className="text-[10px] text-[#8f9db0]">うち消費税 ¥{Number(e.tax_amount).toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3 text-center"><StatusChip status={e.status} /></td>
                    <td className="px-4 py-3 text-center">
                      {e.status === 'pending' && !bulkMode ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleApprove(e.id)} disabled={isPending}
                            className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
                            承認
                          </button>
                          <button onClick={() => handleReject(e.id)} disabled={isPending}
                            className="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
                            却下
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[#c0c8d8]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="py-16 text-center">
                <div className="text-[13px] text-[#8f9db0] mb-3">
                  {searchQuery ? `"${searchQuery}" に一致する経費がありません` : '経費データがありません'}
                </div>
                {!searchQuery && (
                  <button onClick={() => setShowNewModal(true)}
                    className="text-[13px] font-semibold text-blue-600 hover:underline">
                    ＋ 最初の経費を登録する
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ページネーション + 件数 */}
        {filtered.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[12px] text-[#5a6a7e]">
              {filtered.length}件中 {(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, filtered.length)}件表示　合計
              <span className="font-bold text-[#1a2332] ml-1">¥{filtered.reduce((s, e) => s + e.amount, 0).toLocaleString()}</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="px-2.5 py-1 text-[12px] font-semibold border border-[#e2e6ec] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹ 前へ
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={cn(
                      'w-8 h-8 text-[12px] font-semibold border rounded transition-colors',
                      n === page
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-[#e2e6ec] text-[#5a6a7e] hover:bg-slate-50'
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-2.5 py-1 text-[12px] font-semibold border border-[#e2e6ec] rounded hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  次へ ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
