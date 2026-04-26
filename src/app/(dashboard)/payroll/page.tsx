'use client'

import { useState, useEffect, useTransition } from 'react'
import { calculatePayroll, formatYen } from '@/lib/payrollCalculator'
import { cn } from '@/lib/utils'
import { getPayrollData, ensurePayrollRecords, markPayrollSent, markAllPayrollSent, createEmployee } from '@/app/actions/payroll'
import { getPayrollEntries, createPayrollEntry, deletePayrollEntry, type PayrollEntry } from '@/app/actions/payrollEntries'
import { PAYMENT_TYPE_LABEL, type PaymentType } from '@/constants/payroll'

const NOW_MONTH = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()
const NOW_LABEL = (() => {
  const d = new Date()
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})()

interface Employee {
  id: string; name: string; name_kana: string
  base_salary: number; dependents: number; tax_table: string; is_active: boolean
}
interface PayrollRecord {
  id: string; employee_id: string
  base_salary: number; allowances: number
  health_ins: number; pension_ins: number; employment_ins: number
  income_tax: number; residence_tax: number; net_pay: number
  sent_at: string | null
}

// ─── 明細モーダル ──────────────────────────────────────────
function PayrollModal({ emp, rec, onClose }: {
  emp: Employee; rec: PayrollRecord | null; onClose: () => void
}) {
  // 常に現在の従業員マスタの base_salary で再計算する（DB記録値は使わない）
  const result = calculatePayroll({
    baseSalary:   emp.base_salary,
    allowances:   rec?.allowances ?? 0,
    dependents:   emp.dependents,
    taxTable:     (emp.tax_table ?? 'A') as 'A' | 'B',
    age:          30,
    residenceTax: rec?.residence_tax ?? 0,
  })
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div>
            <div className="text-[15px] font-bold text-[#1a2332]">{emp.name} — 給与明細</div>
            <div className="text-[11px] text-[#8f9db0] mt-0.5">{NOW_LABEL}分</div>
          </div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-wide mb-2">支給</div>
            <div className="bg-slate-50 rounded-lg overflow-hidden">
              {[['基本給', emp.base_salary], ['各種手当', rec?.allowances ?? 0]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between px-4 py-2.5 border-b border-[#e2e6ec] last:border-0">
                  <span className="text-[13px] text-[#5a6a7e]">{l}</span>
                  <span className="text-[13px] font-semibold font-mono">{formatYen(v as number)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 bg-blue-50">
                <span className="text-[13px] font-bold text-blue-700">総支給額</span>
                <span className="text-[14px] font-bold text-blue-700 font-mono">{formatYen(result.grossPay)}</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#8f9db0] uppercase tracking-wide mb-2">控除</div>
            <div className="bg-slate-50 rounded-lg overflow-hidden">
              {[
                ['健康保険料',    rec?.health_ins    ?? result.healthIns],
                ['厚生年金保険料', rec?.pension_ins   ?? result.pensionIns],
                ['雇用保険料',    rec?.employment_ins ?? result.employmentIns],
                ['源泉所得税',    rec?.income_tax     ?? result.incomeTax],
                ['住民税',        rec?.residence_tax  ?? 0],
              ].map(([l, v]) => (
                <div key={l as string} className="flex justify-between px-4 py-2.5 border-b border-[#e2e6ec] last:border-0">
                  <span className="text-[13px] text-[#5a6a7e]">{l}</span>
                  <span className="text-[13px] font-semibold text-red-600 font-mono">−{formatYen(v as number)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#1e3a5f] rounded-lg px-5 py-4 flex justify-between items-center">
            <span className="text-[14px] font-bold text-white">差引支給額（振込額）</span>
            <span className="text-[22px] font-bold text-white font-mono">{formatYen(rec?.net_pay ?? result.netPay)}</span>
          </div>
          <div className="text-[11px] text-[#8f9db0] border-t border-[#e2e6ec] pt-3">
            ※ 2026年度 協会けんぽ（東京都）・源泉所得税甲欄に基づく計算
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#e2e6ec] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg">閉じる</button>
        </div>
      </div>
    </div>
  )
}

// ─── 支払い登録モーダル ────────────────────────────────────
function NewEntryModal({ employees, onClose, onSaved }: {
  employees: Array<{ id: string; name: string; name_kana: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    employee_id:  employees[0]?.id ?? '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_type: 'special' as PaymentType,
    amount:       '',
    description:  '',
  })
  const [err, setErr] = useState('')

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const amount    = parseInt(form.amount.replace(/,/g, '')) || 0
  const taxAmount = Math.floor(amount * 0.1021)
  const netAmount = amount - taxAmount

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employee_id) { setErr('従業員を選択してください'); return }
    if (!amount || amount <= 0) { setErr('金額を入力してください'); return }
    setErr('')
    startTransition(async () => {
      const res = await createPayrollEntry({
        employee_id:  form.employee_id,
        payment_date: form.payment_date,
        payment_type: form.payment_type,
        amount,
        tax_amount:   taxAmount,
        description:  form.description || undefined,
      })
      if (res.error) { setErr(res.error); return }
      onSaved(); onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">支払いを登録</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{err}</div>}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">従業員 *</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)}
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400">
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">支払区分</label>
              <select value={form.payment_type} onChange={e => set('payment_type', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400">
                {(Object.entries(PAYMENT_TYPE_LABEL) as [PaymentType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">支払日</label>
              <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">支払金額（税込）*</label>
            <input value={form.amount} onChange={e => set('amount', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="100000"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
          </div>

          {amount > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-[12px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#5a6a7e]">源泉所得税（10.21%）</span>
                <span className="font-mono text-red-600">−{formatYen(taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-[#e2e6ec] pt-1.5 font-semibold">
                <span className="text-[#1a2332]">手取り支給額</span>
                <span className="font-mono text-green-700">{formatYen(netAmount)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">摘要・備考</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="例: 法人クレカ代立替・3月分"
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] rounded-lg hover:bg-slate-50">
              キャンセル
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg">
              {isPending ? '登録中…' : '登録する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 従業員追加モーダル ────────────────────────────────────
function NewEmployeeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({ name: '', name_kana: '', email: '', base_salary: '', dependents: '0', hire_date: new Date().toISOString().slice(0, 10) })
  const [error, setError] = useState('')
  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.base_salary) { setError('氏名・メール・基本給は必須です'); return }
    setError('')
    startTransition(async () => {
      const res = await createEmployee({
        name: form.name, name_kana: form.name_kana, email: form.email,
        base_salary: parseInt(form.base_salary), dependents: parseInt(form.dependents),
        hire_date: form.hire_date,
      })
      if (res.error) { setError(res.error); return }
      onSaved(); onClose()
    })
  }
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec]">
          <div className="text-[15px] font-bold text-[#1a2332]">従業員を追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{error}</div>}
          {[['name','氏名 *','山田 太郎'],['name_kana','フリガナ','ヤマダ タロウ'],['email','メールアドレス *','yamada@example.com']].map(([k,l,p]) => (
            <div key={k}>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">{l}</label>
              <input value={(form as any)[k]} onChange={e => set(k, e.target.value)} placeholder={p}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">基本給（月額）*</label>
              <input value={form.base_salary} onChange={e => set('base_salary', e.target.value.replace(/\D/g,''))} placeholder="300000"
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">扶養人数</label>
              <input type="number" min="0" max="10" value={form.dependents} onChange={e => set('dependents', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">入社日</label>
            <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)}
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] rounded-lg">キャンセル</button>
            <button type="submit" disabled={isPending} className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg">
              {isPending ? '登録中…' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────
export default function PayrollPage() {
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [records, setRecords]           = useState<PayrollRecord[]>([])
  const [entries, setEntries]           = useState<PayrollEntry[]>([])
  const [tab, setTab]                   = useState<'payroll' | 'entries'>('payroll')
  const [loading, setLoading]           = useState(true)
  const [modalEmp, setModalEmp]         = useState<Employee | null>(null)
  const [showNew, setShowNew]           = useState(false)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [toast, setToast]               = useState('')

  async function loadData() {
    setLoading(true)
    const [payrollRes, entriesRes] = await Promise.all([
      getPayrollData(NOW_MONTH),
      getPayrollEntries(NOW_MONTH),
    ])
    setEmployees(payrollRes.employees as Employee[])
    setRecords(payrollRes.records as PayrollRecord[])
    setEntries(entriesRes.data)
    if (payrollRes.employees.length > 0) {
      await ensurePayrollRecords(NOW_MONTH)
      const updated = await getPayrollData(NOW_MONTH)
      setEmployees(updated.employees as Employee[])
      setRecords(updated.records as PayrollRecord[])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function getRecord(empId: string) {
    return records.find(r => r.employee_id === empId) ?? null
  }
  function isSent(empId: string) {
    return getRecord(empId)?.sent_at != null
  }

  function handleSend(empId: string) {
    const rec = getRecord(empId)
    if (!rec) return
    startTransition(async () => {
      await markPayrollSent([rec.id])
      await loadData()
      showToast('送信済みにしました')
    })
  }
  function handleSendAll() {
    startTransition(async () => {
      await markAllPayrollSent(NOW_MONTH)
      await loadData()
      showToast('全員を送信済みにしました')
    })
  }
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // 常に現在の従業員マスタの base_salary で再計算する
  // rec はallow ances・residence_tax など手動入力分のみ参照
  const summaries = employees.map(emp => {
    const rec  = getRecord(emp.id)
    const calc = calculatePayroll({
      baseSalary:   emp.base_salary,
      allowances:   rec?.allowances   ?? 0,
      dependents:   emp.dependents,
      taxTable:     (emp.tax_table    ?? 'A') as 'A' | 'B',
      age:          30,
      residenceTax: rec?.residence_tax ?? 0,
    })
    return {
      emp, rec,
      grossPay:      calc.grossPay,
      healthIns:     calc.healthIns + calc.nursingIns,
      pensionIns:    calc.pensionIns,
      employmentIns: calc.employmentIns,
      incomeTax:     calc.incomeTax,
      residenceTax:  calc.residenceTax,
      netPay:        calc.netPay,
    }
  })

  const totalGross     = summaries.reduce((s, r) => s + r.grossPay, 0)
  const totalNet       = summaries.reduce((s, r) => s + r.netPay, 0)
  const totalIncomeTax = summaries.reduce((s, r) => s + r.incomeTax, 0)

  const entryTotalAmount = entries.reduce((s, e) => s + e.amount, 0)
  const entryTotalTax    = entries.reduce((s, e) => s + e.tax_amount, 0)
  const entryTotalNet    = entryTotalAmount - entryTotalTax

  function empName(id: string) {
    return employees.find(e => e.id === id)?.name ?? '—'
  }
  function handleDeleteEntry(id: string) {
    startTransition(async () => {
      await deletePayrollEntry(id)
      await loadData()
      showToast('削除しました')
    })
  }

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-[13px] font-semibold px-5 py-3 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
      {modalEmp && <PayrollModal emp={modalEmp} rec={getRecord(modalEmp.id)} onClose={() => setModalEmp(null)} />}
      {showNew && <NewEmployeeModal onClose={() => setShowNew(false)} onSaved={loadData} />}
      {showNewEntry && <NewEntryModal employees={employees} onClose={() => setShowNewEntry(false)} onSaved={loadData} />}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <h1 className="text-[16px] font-bold text-[#1a2332]">給与管理</h1>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setTab('payroll')}
              className={cn('px-3 py-1 text-[12px] font-semibold rounded-md transition-colors', tab === 'payroll' ? 'bg-white text-[#1a2332] shadow-sm' : 'text-[#8f9db0] hover:text-[#1a2332]')}>
              月次給与
            </button>
            <button onClick={() => setTab('entries')}
              className={cn('px-3 py-1 text-[12px] font-semibold rounded-md transition-colors', tab === 'entries' ? 'bg-white text-[#1a2332] shadow-sm' : 'text-[#8f9db0] hover:text-[#1a2332]')}>
              支払い記録
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#8f9db0]">{NOW_LABEL}分</span>
          {tab === 'payroll' ? (
            <>
              <button onClick={() => setShowNew(true)}
                className="px-4 py-2 text-[13px] font-semibold text-[#1a2332] bg-white border border-[#e2e6ec] hover:bg-slate-50 rounded-lg transition-colors">
                ＋ 従業員追加
              </button>
              <button onClick={handleSendAll} disabled={isPending || employees.length === 0}
                className="px-4 py-2 text-[13px] font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
                全員に明細を送信
              </button>
            </>
          ) : (
            <button onClick={() => setShowNewEntry(true)}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors">
              ＋ 支払いを登録
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        {tab === 'entries' ? (
          <>
            {/* 支払い記録サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-7">
              {[
                { label: '支払件数',      val: `${entries.length}件`,       sub: NOW_LABEL,     color: 'text-[#1a2332]', border: 'border-l-blue-600' },
                { label: '支払総額',      val: formatYen(entryTotalAmount), sub: '税込合計',    color: 'text-blue-600',  border: 'border-l-blue-600' },
                { label: '源泉所得税合計', val: formatYen(entryTotalTax),   sub: '10.21% 控除', color: 'text-red-500',   border: 'border-l-red-400'  },
              ].map(c => (
                <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
                  <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
                  <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
                  <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center text-[13px] text-[#8f9db0]">データを読み込み中…</div>
            ) : entries.length === 0 ? (
              <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center">
                <div className="text-[13px] text-[#8f9db0] mb-3">{NOW_LABEL}の支払い記録はありません</div>
                <button onClick={() => setShowNewEntry(true)} className="text-[13px] font-semibold text-blue-600 hover:underline">＋ 最初の支払いを登録する</button>
              </div>
            ) : (
              <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                      {['支払日','従業員','区分','支払金額','源泉所得税','手取り金額','摘要',''].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.4px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => {
                      const net = entry.amount - entry.tax_amount
                      return (
                        <tr key={entry.id} className="border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-[13px] text-[#5a6a7e] whitespace-nowrap">{entry.payment_date}</td>
                          <td className="px-4 py-3">
                            <div className="text-[13px] font-semibold text-[#1a2332]">{entry.employee?.name ?? empName(entry.employee_id)}</div>
                            {entry.employee?.name_kana && <div className="text-[10px] text-[#8f9db0]">{entry.employee.name_kana}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                              {PAYMENT_TYPE_LABEL[entry.payment_type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-semibold font-mono text-right">{formatYen(entry.amount)}</td>
                          <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(entry.tax_amount)}</td>
                          <td className="px-4 py-3 text-[13px] font-bold text-green-700 font-mono text-right">{formatYen(net)}</td>
                          <td className="px-4 py-3 text-[12px] text-[#8f9db0] max-w-[160px] truncate">{entry.description ?? '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDeleteEntry(entry.id)} disabled={isPending}
                              className="text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
                              削除
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-[#cdd3dc]">
                      <td colSpan={3} className="px-4 py-3 text-[12px] font-bold text-[#5a6a7e]">合計 {entries.length}件</td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[#1a2332] font-mono text-right">{formatYen(entryTotalAmount)}</td>
                      <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(entryTotalTax)}</td>
                      <td className="px-4 py-3 text-[14px] font-bold text-green-700 font-mono text-right">{formatYen(entryTotalNet)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        ) : (
        <>
        {/* サマリー */}
        <div className="grid grid-cols-4 gap-4 mb-7">
          {[
            { label: '従業員数',      val: `${employees.length}名`,  sub: '在籍中',            color: 'text-[#1a2332]', border: 'border-l-blue-600'  },
            { label: '給与支払総額',   val: formatYen(totalGross),    sub: '総支給額合計',       color: 'text-blue-600',  border: 'border-l-blue-600'  },
            { label: '差引支給総額',   val: formatYen(totalNet),      sub: '振込合計額',          color: 'text-green-600', border: 'border-l-green-500' },
            { label: '納付源泉所得税', val: formatYen(totalIncomeTax),sub: '翌月10日納付',        color: 'text-red-500',   border: 'border-l-red-400'   },
          ].map(c => (
            <div key={c.label} className={cn('bg-white border border-[#e2e6ec] border-l-4 rounded-lg p-4 shadow-sm', c.border)}>
              <div className="text-[11px] font-semibold text-[#8f9db0] uppercase tracking-wide mb-1">{c.label}</div>
              <div className={cn('text-[20px] font-bold', c.color)}>{c.val}</div>
              <div className="text-[11px] text-[#8f9db0] mt-1">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-[12px] text-blue-800 flex justify-between">
          <span>2026年度 協会けんぽ（東京都）・源泉所得税甲欄に基づく自動計算</span>
          <span className="text-[11px] text-blue-600">健康保険 10.00% / 厚生年金 18.30% / 雇用保険 1.55%（労使合計）</span>
        </div>

        {loading ? (
          <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center text-[13px] text-[#8f9db0]">データを読み込み中…</div>
        ) : employees.length === 0 ? (
          <div className="bg-white border border-[#e2e6ec] rounded-lg p-16 text-center">
            <div className="text-[13px] text-[#8f9db0] mb-3">従業員が登録されていません</div>
            <button onClick={() => setShowNew(true)} className="text-[13px] font-semibold text-blue-600 hover:underline">＋ 最初の従業員を追加する</button>
          </div>
        ) : (
          <div className="bg-white border border-[#e2e6ec] rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                  {['氏名','総支給額','健康保険','厚生年金','雇用保険','源泉所得税','住民税','差引支給額','状態','操作'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-[#8f9db0] uppercase tracking-[0.4px] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ emp, rec, grossPay, healthIns, pensionIns, employmentIns, incomeTax, residenceTax, netPay }) => (
                  <tr key={emp.id} className="border-b border-[#e2e6ec] last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-semibold text-[#1a2332]">{emp.name}</div>
                      <div className="text-[10px] text-[#8f9db0]">{emp.name_kana}</div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#1a2332] font-mono text-right">{formatYen(grossPay)}</td>
                    <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(healthIns)}</td>
                    <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(pensionIns)}</td>
                    <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(employmentIns)}</td>
                    <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(incomeTax)}</td>
                    <td className="px-4 py-3 text-[12px] text-red-500 font-mono text-right">−{formatYen(residenceTax)}</td>
                    <td className="px-4 py-3 text-[14px] font-bold text-green-700 font-mono text-right">{formatYen(netPay)}</td>
                    <td className="px-4 py-3">
                      {isSent(emp.id) ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />送信済
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />未送信
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setModalEmp(emp)}
                          className="text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded transition-colors">
                          明細確認
                        </button>
                        {!isSent(emp.id) && (
                          <button onClick={() => handleSend(emp.id)} disabled={isPending || !rec}
                            className="text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2.5 py-1 rounded transition-colors disabled:opacity-50">
                            送信
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-[#cdd3dc]">
                  <td className="px-4 py-3 text-[12px] font-bold text-[#5a6a7e]">合計</td>
                  <td className="px-4 py-3 text-[13px] font-bold text-[#1a2332] font-mono text-right">{formatYen(totalGross)}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(summaries.reduce((s,r)=>s+r.healthIns,0))}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(summaries.reduce((s,r)=>s+r.pensionIns,0))}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(summaries.reduce((s,r)=>s+r.employmentIns,0))}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(totalIncomeTax)}</td>
                  <td className="px-4 py-3 text-[12px] font-bold text-red-500 font-mono text-right">−{formatYen(summaries.reduce((s,r)=>s+r.residenceTax,0))}</td>
                  <td className="px-4 py-3 text-[14px] font-bold text-green-700 font-mono text-right">{formatYen(totalNet)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  )
}
