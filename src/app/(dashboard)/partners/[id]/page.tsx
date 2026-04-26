'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updatePartner, type Partner } from '@/app/actions/partners'
import {
  createWorkOrder, updateWorkOrderStatus, deleteWorkOrder,
  WORK_ORDER_STATUS, type WorkOrder,
} from '@/app/actions/workOrders'
import { createDocument, deleteDocument, type Document, type DocType } from '@/app/actions/documents'
import {
  calculateDeductibleTax,
  getInvoiceStatus,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_COLOR,
} from '@/lib/tax'

function formatYen(n: number) { return `¥${n.toLocaleString('ja-JP')}` }
function formatDate(s: string | null) {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${y}年${parseInt(m)}月${parseInt(d)}日`
}

// ─── 仕入税額控除バッジ ───────────────────────────────────
function InvoiceBadge({ isRegistered, size = 'sm' }: { isRegistered: boolean; size?: 'sm' | 'lg' }) {
  const status = getInvoiceStatus(isRegistered)
  const color  = INVOICE_STATUS_COLOR[status]
  const label  = INVOICE_STATUS_LABEL[status]
  return (
    <span className={cn(
      'inline-flex items-center font-semibold rounded-full border',
      size === 'lg' ? 'text-[12px] px-3 py-1' : 'text-[10px] px-2 py-0.5',
      color,
    )}>
      {label}
    </span>
  )
}

// ─── DocumentPreviewModal ────────────────────────────────
function DocumentPreviewModal({
  partner,
  tenantName,
  docType,
  onClose,
  onIssued,
}: {
  partner: Partner
  tenantName: string | null
  docType: DocType
  onClose: () => void
  onIssued: () => void
}) {
  const isPO = docType === 'purchase_order'
  const [isPending, startTransition] = useTransition()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    title:       isPO ? '業務委託発注' : '業務委託請求',
    amount:      String(partner.standard_unit_price || 0),
    description: '',
    issue_date:  today,
  })

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  // 税務計算（amountを税抜として入力し、税込で判定）
  const netExcl   = Number(form.amount) || 0
  const taxAmt    = Math.floor(netExcl * 0.1)
  const netIncl   = netExcl + taxAmt
  const withheld  = Math.floor(netExcl * partner.withholding_rate)
  const payment   = netExcl - withheld  // 差引支払金額（消費税別）

  const taxCalc = calculateDeductibleTax({
    amountIncludingTax:  netIncl,
    isInvoiceRegistered: partner.is_invoice_registered,
  })

  const invoiceStatus = getInvoiceStatus(partner.is_invoice_registered)
  const statusColor   = INVOICE_STATUS_COLOR[invoiceStatus]

  function handleIssue() {
    startTransition(async () => {
      const res = await createDocument({
        partner_id:  partner.id,
        doc_type:    docType,
        title:       form.title,
        amount:      netExcl,
        description: form.description || undefined,
        issue_date:  form.issue_date,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success(`${isPO ? '発注書' : '請求書'} ${res.docNumber} を発行しました`)
      onIssued()
      setTimeout(() => window.print(), 100)
    })
  }

  const docLabel  = isPO ? '発注書' : '請求書'
  const docPrefix = isPO ? 'PO'     : 'INV'

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Controls */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec] sticky top-0 bg-white">
          <div className="text-[15px] font-bold text-[#1a2332]">{docLabel}を発行</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>

        <div className="p-6 print:p-0">
          {/* Form fields */}
          <div className="print:hidden space-y-3 mb-6">
            {/* インボイスステータス表示 */}
            <div className={cn(
              'flex items-center gap-3 p-3 rounded-lg border text-[12px]',
              statusColor,
            )}>
              <span className="font-bold">仕入税額控除区分:</span>
              <span className="font-semibold">{INVOICE_STATUS_LABEL[invoiceStatus]}</span>
              {taxCalc.isMinorException && (
                <span className="ml-1 text-[11px] opacity-75">（少額特例 — 税込1万円未満）</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">件名</label>
                <input
                  value={form.title}
                  onChange={e => set('title', e.target.value)}
                  className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">発行日</label>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={e => set('issue_date', e.target.value)}
                  className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">金額（税抜）</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">摘要</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            {/* 仕入税額控除の計算サマリ */}
            {netExcl > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 text-[12px] space-y-1.5">
                <div className="text-[11px] font-bold text-[#5a6a7e] mb-2 uppercase tracking-wide">
                  会計処理上の仕入税額控除
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5a6a7e]">消費税額（10%）</span>
                  <span className="font-mono">{formatYen(taxCalc.consumptionTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5a6a7e]">
                    控除可能額
                    {!taxCalc.isMinorException && taxCalc.deductibleRate < 1 && (
                      <span className="ml-1 text-amber-600">（{Math.round(taxCalc.deductibleRate * 100)}%控除）</span>
                    )}
                    {taxCalc.isMinorException && (
                      <span className="ml-1 text-green-600">（少額特例 全額）</span>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-green-700">{formatYen(taxCalc.deductibleTax)}</span>
                </div>
                {taxCalc.nonDeductibleTax > 0 && (
                  <div className="flex justify-between border-t border-[#e2e6ec] pt-1.5 mt-1.5">
                    <span className="text-[#8f9db0]">控除不可（費用計上）</span>
                    <span className="font-mono text-red-600">{formatYen(taxCalc.nonDeductibleTax)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 印刷プレビュー */}
          <div className="border border-[#e2e6ec] rounded-xl p-8 print:border-none print:p-0 text-[#1a2332]">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="text-[28px] font-bold mb-2">{docLabel}</div>
                <div className="text-[13px] text-[#5a6a7e]">
                  {docPrefix}-{today.replace(/-/g, '')}-XXX
                </div>
                <div className="text-[12px] text-[#8f9db0] mt-1">発行日: {formatDate(form.issue_date)}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-bold">{tenantName ?? '—'}</div>
                <div className="text-[12px] text-[#5a6a7e] mt-0.5">発行者</div>
              </div>
            </div>

            <div className="border-b border-[#e2e6ec] pb-4 mb-6">
              <div className="text-[14px] font-bold mb-1">{partner.company_name} 御中</div>
              {partner.contact_name && (
                <div className="text-[12px] text-[#5a6a7e]">{partner.contact_name} 様</div>
              )}
              {/* インボイス区分 — 印刷時も表示 */}
              <div className={cn(
                'inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border mt-2',
                INVOICE_STATUS_COLOR[invoiceStatus]
              )}>
                {INVOICE_STATUS_LABEL[invoiceStatus]}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-[13px] font-bold mb-1">{form.title || '—'}</div>
              {form.description && (
                <div className="text-[12px] text-[#5a6a7e] whitespace-pre-wrap">{form.description}</div>
              )}
            </div>

            <table className="w-full text-[13px] border border-[#e2e6ec] rounded-lg overflow-hidden mb-6">
              <thead>
                <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                  <th className="text-left px-4 py-2 font-semibold">項目</th>
                  <th className="text-right px-4 py-2 font-semibold">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#e2e6ec]">
                  <td className="px-4 py-3">{form.title || '業務委託費'}（税抜）</td>
                  <td className="px-4 py-3 text-right font-mono">{formatYen(netExcl)}</td>
                </tr>
                <tr className="border-b border-[#e2e6ec]">
                  <td className="px-4 py-3 text-[#5a6a7e]">消費税（10%）</td>
                  <td className="px-4 py-3 text-right font-mono">{formatYen(taxAmt)}</td>
                </tr>
                <tr className="border-b border-[#e2e6ec] font-semibold">
                  <td className="px-4 py-3">小計（税込）</td>
                  <td className="px-4 py-3 text-right font-mono">{formatYen(netIncl)}</td>
                </tr>
                <tr className="border-b border-[#e2e6ec]">
                  <td className="px-4 py-3 text-[#5a6a7e]">
                    源泉徴収税額（{(partner.withholding_rate * 100).toFixed(2)}%）
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[#5a6a7e]">
                    − {formatYen(withheld)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-3">差引支払金額</td>
                  <td className="px-4 py-3 text-right font-mono text-[18px]">{formatYen(payment)}</td>
                </tr>
              </tbody>
            </table>

            {partner.bank_name && (
              <div className="border border-[#e2e6ec] rounded-lg p-4 text-[12px]">
                <div className="font-bold mb-1 text-[#5a6a7e]">振込先口座</div>
                <div>
                  {partner.bank_name}
                  {partner.bank_branch && ` ${partner.bank_branch}`}
                  {` ${partner.bank_account_type}  ${partner.bank_account_number ?? ''}`}
                  {partner.bank_account_name && ` （${partner.bank_account_name}）`}
                </div>
              </div>
            )}

            {partner.invoice_number && (
              <div className="mt-3 text-[11px] text-[#8f9db0]">
                インボイス登録番号: {partner.invoice_number}
              </div>
            )}
          </div>

          <div className="print:hidden flex gap-3 mt-6">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
              キャンセル
            </button>
            <button
              onClick={handleIssue}
              disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors"
            >
              {isPending ? '発行中…' : `${docLabel}を発行・印刷`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── NewWorkOrderModal ────────────────────────────────────
function NewWorkOrderModal({
  partnerId,
  onClose,
  onSaved,
}: {
  partnerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    title:         '',
    description:   '',
    order_date:    new Date().toISOString().slice(0, 10),
    delivery_date: '',
    amount:        '',
    notes:         '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = '件名を入力してください'
    if (!form.amount || isNaN(Number(form.amount))) errs.amount = '金額を入力してください'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    startTransition(async () => {
      const res = await createWorkOrder({
        partner_id:    partnerId,
        title:         form.title.trim(),
        description:   form.description || undefined,
        order_date:    form.order_date,
        delivery_date: form.delivery_date || undefined,
        amount:        Number(form.amount),
        notes:         form.notes || undefined,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('発注を登録しました')
      onSaved()
      onClose()
    })
  }

  const field = (key: string, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form]}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100',
          errors[key] ? 'border-red-400' : 'border-[#e2e6ec]'
        )}
      />
      {errors[key] && <p className="text-[11px] text-red-600 mt-1">{errors[key]}</p>}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec] sticky top-0 bg-white">
          <div className="text-[15px] font-bold text-[#1a2332]">発注を追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {field('title', '件名 *', '例: Webサイトデザイン制作')}
          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">詳細</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('order_date', '発注日', '', 'date')}
            {field('delivery_date', '納期', '', 'date')}
          </div>
          {field('amount', '金額（税抜・円）*', '0')}
          {field('notes', 'メモ', '')}
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

// ─── EditPartnerModal ─────────────────────────────────────
function EditPartnerModal({
  partner,
  onClose,
  onSaved,
}: {
  partner: Partner
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    company_name:          partner.company_name,
    contact_name:          partner.contact_name          ?? '',
    email:                 partner.email                 ?? '',
    phone:                 partner.phone                 ?? '',
    address:               partner.address               ?? '',
    bank_name:             partner.bank_name             ?? '',
    bank_branch:           partner.bank_branch           ?? '',
    bank_account_type:     partner.bank_account_type,
    bank_account_number:   partner.bank_account_number   ?? '',
    bank_account_name:     partner.bank_account_name     ?? '',
    standard_unit_price:   String(partner.standard_unit_price),
    invoice_number:        partner.invoice_number        ?? '',
    is_invoice_registered: partner.is_invoice_registered,
    withholding_rate:      String((partner.withholding_rate * 100).toFixed(2)),
    notes:                 partner.notes                 ?? '',
    is_active:             partner.is_active,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string | boolean) { setForm(p => ({ ...p, [k]: v })) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.company_name.trim()) errs.company_name = '会社名を入力してください'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    startTransition(async () => {
      const res = await updatePartner(partner.id, {
        company_name:          form.company_name.trim(),
        contact_name:          form.contact_name          || null,
        email:                 form.email                 || null,
        phone:                 form.phone                 || null,
        address:               form.address               || null,
        bank_name:             form.bank_name             || null,
        bank_branch:           form.bank_branch           || null,
        bank_account_type:     form.bank_account_type,
        bank_account_number:   form.bank_account_number   || null,
        bank_account_name:     form.bank_account_name     || null,
        standard_unit_price:   Number(form.standard_unit_price) || 0,
        invoice_number:        form.invoice_number        || null,
        is_invoice_registered: form.is_invoice_registered,
        withholding_rate:      Number(form.withholding_rate) / 100 || 0.1021,
        notes:                 form.notes                 || null,
        is_active:             form.is_active,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('パートナー情報を更新しました')
      onSaved()
      onClose()
    })
  }

  const field = (key: string, label: string, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">{label}</label>
      <input
        type={type}
        value={form[key as keyof typeof form] as string}
        onChange={e => set(key, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 border rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100',
          errors[key] ? 'border-red-400' : 'border-[#e2e6ec]'
        )}
      />
      {errors[key] && <p className="text-[11px] text-red-600 mt-1">{errors[key]}</p>}
    </div>
  )

  const previewStatus = getInvoiceStatus(form.is_invoice_registered)

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec] sticky top-0 bg-white">
          <div className="text-[15px] font-bold text-[#1a2332]">パートナー情報を編集</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('company_name', '会社名 *')}
            {field('contact_name', '担当者名')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'メールアドレス', '', 'email')}
            {field('phone', '電話番号')}
          </div>
          {field('address', '住所')}

          {/* インボイス・請求設定 */}
          <div className="border-t border-[#e2e6ec] pt-4">
            <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">インボイス・請求設定</div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg mb-3">
              <div>
                <div className="text-[13px] font-semibold text-[#1a2332]">適格請求書発行事業者</div>
                <div className={cn(
                  'text-[11px] mt-0.5 font-semibold',
                  form.is_invoice_registered ? 'text-green-600' : 'text-amber-600'
                )}>
                  {INVOICE_STATUS_LABEL[previewStatus]}
                </div>
              </div>
              <button
                type="button"
                onClick={() => set('is_invoice_registered', !form.is_invoice_registered)}
                className={cn(
                  'relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors flex-shrink-0',
                  form.is_invoice_registered ? 'bg-green-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                  form.is_invoice_registered ? 'translate-x-4' : 'translate-x-0'
                )} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {field('standard_unit_price', '標準単価（円）')}
              {field('invoice_number', 'インボイス登録番号')}
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">源泉徴収率（%）</label>
              <input
                type="text"
                value={form.withholding_rate}
                onChange={e => set('withholding_rate', e.target.value)}
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* 銀行口座 */}
          <div className="border-t border-[#e2e6ec] pt-4">
            <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">銀行口座</div>
            <div className="grid grid-cols-2 gap-3">
              {field('bank_name', '銀行名')}
              {field('bank_branch', '支店名')}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">口座種別</label>
                <select
                  value={form.bank_account_type}
                  onChange={e => set('bank_account_type', e.target.value)}
                  className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] bg-white focus:outline-none focus:border-blue-400"
                >
                  <option>普通</option>
                  <option>当座</option>
                </select>
              </div>
              {field('bank_account_number', '口座番号')}
              {field('bank_account_name', '口座名義')}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">備考</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex items-center justify-between py-3 border-t border-[#e2e6ec]">
            <div>
              <div className="text-[13px] font-semibold text-[#1a2332]">取引ステータス</div>
              <div className="text-[11px] text-[#8f9db0]">無効にするとリストから非表示になります</div>
            </div>
            <button
              type="button"
              onClick={() => set('is_active', !form.is_active)}
              className={cn(
                'relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors',
                form.is_active ? 'bg-blue-600' : 'bg-slate-200'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform',
                form.is_active ? 'translate-x-4' : 'translate-x-0'
              )} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] bg-white hover:bg-slate-50 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] disabled:opacity-50 rounded-lg transition-colors">
              {isPending ? '保存中…' : '保存する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────
export default function PartnerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [partner, setPartner]         = useState<Partner | null>(null)
  const [tenantName, setTenantName]   = useState<string | null>(null)
  const [workOrders, setWorkOrders]   = useState<WorkOrder[]>([])
  const [documents, setDocuments]     = useState<Document[]>([])
  const [loading, setLoading]         = useState(true)

  const [showEdit, setShowEdit]         = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [docModal, setDocModal]         = useState<DocType | null>(null)
  const [, startTransition]             = useTransition()

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/partners/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load partner detail: ${res.statusText}`)
      const payload = await res.json()
      setPartner(payload.partner)
      setTenantName(payload.tenantName)
      setWorkOrders(payload.workOrders ?? [])
      setDocuments(payload.documents ?? [])
    } catch (e) {
      console.error('[PartnerDetail] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  function handleDeleteOrder(orderId: string) {
    if (!confirm('この発注を削除しますか？')) return
    startTransition(async () => {
      const res = await deleteWorkOrder(orderId, id)
      if (res.error) { toast.error(res.error); return }
      toast.success('削除しました')
      load()
    })
  }

  function handleDeleteDoc(docId: string) {
    if (!confirm('この書類を削除しますか？')) return
    startTransition(async () => {
      const res = await deleteDocument(docId, id)
      if (res.error) { toast.error(res.error); return }
      toast.success('削除しました')
      load()
    })
  }

  function handleStatusChange(orderId: string, status: string) {
    startTransition(async () => {
      const res = await updateWorkOrderStatus(orderId, status, id)
      if (res.error) { toast.error(res.error); return }
      setWorkOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    })
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white border border-[#e2e6ec] rounded-xl h-24" />
        ))}
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="p-8 text-center py-24">
        <div className="text-[15px] font-bold text-[#1a2332] mb-2">パートナーが見つかりません</div>
        <button onClick={() => router.push('/partners')} className="text-[13px] text-blue-600 hover:underline">
          一覧に戻る
        </button>
      </div>
    )
  }

  const invoiceStatus = getInvoiceStatus(partner.is_invoice_registered)

  const thisMonthOrders = workOrders.filter(o => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return o.order_date.startsWith(`${y}-${m}`) && o.status !== 'cancelled'
  })
  const monthlyTotal = thisMonthOrders.reduce((s, o) => s + Number(o.amount), 0)

  return (
    <div>
      {showEdit && (
        <EditPartnerModal
          partner={partner}
          onClose={() => setShowEdit(false)}
          onSaved={load}
        />
      )}
      {showNewOrder && (
        <NewWorkOrderModal
          partnerId={id}
          onClose={() => setShowNewOrder(false)}
          onSaved={load}
        />
      )}
      {docModal && (
        <DocumentPreviewModal
          partner={partner}
          tenantName={tenantName}
          docType={docModal}
          onClose={() => setDocModal(null)}
          onIssued={load}
        />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center gap-3 sticky top-0 z-40">
        <button
          onClick={() => router.push('/partners')}
          className="text-[#8f9db0] hover:text-[#1a2332] text-[13px] transition-colors"
        >
          ← パートナー一覧
        </button>
        <span className="text-[#e2e6ec]">/</span>
        <h1 className="text-[16px] font-bold text-[#1a2332] truncate">{partner.company_name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setDocModal('purchase_order')}
            className="px-3 py-1.5 text-[12px] font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            発注書を発行
          </button>
          <button
            onClick={() => setDocModal('invoice')}
            className="px-3 py-1.5 text-[12px] font-semibold text-[#1e3a5f] border border-[#1e3a5f] rounded-lg hover:bg-[#1e3a5f] hover:text-white transition-colors"
          >
            請求書を発行
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-1.5 text-[12px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors"
          >
            編集
          </button>
        </div>
      </div>

      <div className="p-8 max-w-5xl space-y-8">
        {/* Partner info card */}
        <div className="bg-white border border-[#e2e6ec] rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-xl bg-[#1e3a5f] text-white flex items-center justify-center text-[20px] font-bold flex-shrink-0">
              {partner.company_name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="text-[18px] font-bold text-[#1a2332]">{partner.company_name}</div>
                <InvoiceBadge isRegistered={partner.is_invoice_registered} size="lg" />
              </div>
              {partner.contact_name && (
                <div className="text-[13px] text-[#5a6a7e] mb-2">担当: {partner.contact_name}</div>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[#5a6a7e]">
                {partner.email   && <span>✉ {partner.email}</span>}
                {partner.phone   && <span>☎ {partner.phone}</span>}
                {partner.address && <span>📍 {partner.address}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-[11px] text-[#8f9db0] mb-0.5">今月の発注合計</div>
              <div className={cn(
                'text-[18px] font-bold font-mono',
                monthlyTotal > 0 ? 'text-[#1a2332]' : 'text-[#8f9db0]'
              )}>
                {formatYen(monthlyTotal)}
              </div>
            </div>
          </div>

          {/* 税務情報サマリ */}
          {!partner.is_invoice_registered && (
            <div className={cn(
              'mt-4 rounded-lg border px-4 py-3 text-[12px]',
              INVOICE_STATUS_COLOR[invoiceStatus]
            )}>
              <div className="font-bold mb-0.5">{INVOICE_STATUS_LABEL[invoiceStatus]}</div>
              <div className="opacity-80">
                {invoiceStatus === 'transitional_80' &&
                  '税込1万円以上の支払いは仕入税額の80%のみ控除可能です（〜2026/9/30）。'}
                {invoiceStatus === 'transitional_50' &&
                  '税込1万円以上の支払いは仕入税額の50%のみ控除可能です（〜2029/9/30）。'}
                {invoiceStatus === 'exempt' &&
                  '仕入税額控除は適用されません。'}
                {' '}税込1万円未満の取引は少額特例により全額控除されます。
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#e2e6ec] text-[12px]">
            <div>
              <div className="text-[11px] font-semibold text-[#8f9db0] mb-1">標準単価</div>
              <div className="font-mono font-semibold text-[#1a2332]">
                {partner.standard_unit_price > 0 ? formatYen(partner.standard_unit_price) : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#8f9db0] mb-1">源泉徴収率</div>
              <div className="font-semibold text-[#1a2332]">
                {(partner.withholding_rate * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[#8f9db0] mb-1">インボイス番号</div>
              <div className="font-semibold text-[#1a2332]">{partner.invoice_number || '—'}</div>
            </div>
          </div>

          {partner.bank_name && (
            <div className="mt-4 pt-4 border-t border-[#e2e6ec] text-[12px]">
              <div className="text-[11px] font-semibold text-[#8f9db0] mb-1">振込先口座</div>
              <div className="text-[#1a2332]">
                {partner.bank_name}
                {partner.bank_branch && ` ${partner.bank_branch}`}
                {` ${partner.bank_account_type}  ${partner.bank_account_number ?? '—'}`}
                {partner.bank_account_name && ` （${partner.bank_account_name}）`}
              </div>
            </div>
          )}
        </div>

        {/* Work Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-bold text-[#1a2332]">
              発注一覧
              <span className="ml-2 text-[11px] font-semibold text-[#8f9db0]">{workOrders.length}件</span>
            </div>
            <button
              onClick={() => setShowNewOrder(true)}
              className="px-3 py-1.5 text-[12px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              ＋ 発注を追加
            </button>
          </div>

          {workOrders.length === 0 ? (
            <div className="bg-white border border-[#e2e6ec] rounded-xl py-10 text-center text-[13px] text-[#8f9db0]">
              発注履歴がありません
            </div>
          ) : (
            <div className="space-y-2">
              {workOrders.map(o => {
                const st = WORK_ORDER_STATUS[o.status] ?? WORK_ORDER_STATUS.ordered
                return (
                  <div key={o.id} className="bg-white border border-[#e2e6ec] rounded-xl px-5 py-4 flex items-center gap-4 shadow-sm">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', st.dot)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#1a2332] mb-0.5">{o.title}</div>
                      <div className="text-[11px] text-[#8f9db0]">
                        発注日 {formatDate(o.order_date)}
                        {o.delivery_date && ` 　納期 ${formatDate(o.delivery_date)}`}
                      </div>
                    </div>
                    <div className="font-mono text-[13px] font-bold text-[#1a2332] flex-shrink-0">
                      {formatYen(Number(o.amount))}
                    </div>
                    <select
                      value={o.status}
                      onChange={e => handleStatusChange(o.id, e.target.value)}
                      className={cn(
                        'text-[11px] font-semibold px-2 py-1 rounded-lg border-0 focus:outline-none cursor-pointer flex-shrink-0',
                        st.cls
                      )}
                    >
                      {Object.entries(WORK_ORDER_STATUS).map(([v, s]) => (
                        <option key={v} value={v}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleDeleteOrder(o.id)}
                      className="text-[11px] text-[#8f9db0] hover:text-red-600 flex-shrink-0 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-bold text-[#1a2332]">
              発行済み書類
              <span className="ml-2 text-[11px] font-semibold text-[#8f9db0]">{documents.length}件</span>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="bg-white border border-[#e2e6ec] rounded-xl py-10 text-center text-[13px] text-[#8f9db0]">
              発行した書類がありません
            </div>
          ) : (
            <div className="bg-white border border-[#e2e6ec] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#e2e6ec]">
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#5a6a7e]">書類番号</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#5a6a7e]">種別</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#5a6a7e]">件名</th>
                    <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#5a6a7e]">発行日</th>
                    <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#5a6a7e]">金額（税抜）</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, i) => (
                    <tr key={doc.id} className={cn('border-b border-[#e2e6ec]', i === documents.length - 1 && 'border-b-0')}>
                      <td className="px-5 py-3 font-mono text-[12px] text-[#5a6a7e]">{doc.doc_number}</td>
                      <td className="px-5 py-3">
                        <span className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          doc.doc_type === 'purchase_order'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-green-50 text-green-700'
                        )}>
                          {doc.doc_type === 'purchase_order' ? '発注書' : '請求書'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#1a2332]">{doc.title}</td>
                      <td className="px-5 py-3 text-[#5a6a7e]">{formatDate(doc.issue_date)}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-[#1a2332]">
                        {formatYen(Number(doc.amount))}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className="text-[11px] text-[#8f9db0] hover:text-red-600 transition-colors"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
