'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getPartnersWithMonthlyTotal,
  createPartner,
  type PartnerWithTotal,
} from '@/app/actions/partners'

function formatYen(n: number) { return `¥${n.toLocaleString('ja-JP')}` }

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-[14px] font-bold flex-shrink-0">
      {name.slice(0, 1)}
    </div>
  )
}

// ─── 追加モーダル ────────────────────────────────────────────
function NewPartnerModal({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    company_name:        '',
    contact_name:        '',
    email:               '',
    phone:               '',
    address:             '',
    bank_name:           '',
    bank_branch:         '',
    bank_account_type:   '普通',
    bank_account_number: '',
    bank_account_name:   '',
    standard_unit_price: '',
    invoice_number:      '',
    withholding_rate:    '10.21',
    notes:               '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.company_name.trim()) errs.company_name = '会社名を入力してください'
    return errs
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})

    startTransition(async () => {
      const res = await createPartner({
        company_name:        form.company_name.trim(),
        contact_name:        form.contact_name        || undefined,
        email:               form.email               || undefined,
        phone:               form.phone               || undefined,
        address:             form.address             || undefined,
        bank_name:           form.bank_name           || undefined,
        bank_branch:         form.bank_branch         || undefined,
        bank_account_type:   form.bank_account_type   || undefined,
        bank_account_number: form.bank_account_number || undefined,
        bank_account_name:   form.bank_account_name   || undefined,
        standard_unit_price: Number(form.standard_unit_price) || 0,
        invoice_number:      form.invoice_number      || undefined,
        withholding_rate:    Number(form.withholding_rate) / 100 || 0.1021,
        notes:               form.notes               || undefined,
      })
      if (res.error) { toast.error(res.error); return }
      toast.success('パートナーを追加しました')
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e6ec] sticky top-0 bg-white">
          <div className="text-[15px] font-bold text-[#1a2332]">パートナーを追加</div>
          <button onClick={onClose} className="text-[#8f9db0] hover:text-[#1a2332] text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          {/* 基本情報 */}
          <div className="grid grid-cols-2 gap-3">
            {field('company_name', '会社名 *', '例: 株式会社サンプル')}
            {field('contact_name', '担当者名', '例: 山田 太郎')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'メールアドレス', 'example@company.co.jp', 'email')}
            {field('phone', '電話番号', '03-0000-0000')}
          </div>
          {field('address', '住所', '例: 東京都渋谷区...')}

          {/* 請求・単価 */}
          <div className="border-t border-[#e2e6ec] pt-4">
            <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">請求・単価設定</div>
            <div className="grid grid-cols-2 gap-3">
              {field('standard_unit_price', '標準単価（円）', '0')}
              {field('invoice_number', 'インボイス登録番号', 'T1234567890123')}
            </div>
            <div className="mt-3">
              <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">源泉徴収率（%）</label>
              <input
                type="text"
                value={form.withholding_rate}
                onChange={e => set('withholding_rate', e.target.value)}
                placeholder="10.21"
                className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* 銀行口座 */}
          <div className="border-t border-[#e2e6ec] pt-4">
            <div className="text-[11px] font-bold text-[#5a6a7e] uppercase tracking-wide mb-3">銀行口座</div>
            <div className="grid grid-cols-2 gap-3">
              {field('bank_name', '銀行名', '例: 三菱UFJ銀行')}
              {field('bank_branch', '支店名', '例: 渋谷支店')}
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
              {field('bank_account_number', '口座番号', '1234567')}
              {field('bank_account_name', '口座名義', '例: ヤマダ タロウ')}
            </div>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-[11px] font-semibold text-[#5a6a7e] mb-1">備考</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="メモ・特記事項..."
              className="w-full px-3 py-2 border border-[#e2e6ec] rounded-lg text-[13px] focus:outline-none focus:border-blue-400 resize-none"
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
export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerWithTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await getPartnersWithMonthlyTotal()
    setPartners(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div>
      {showNew && (
        <NewPartnerModal onClose={() => setShowNew(false)} onSaved={load} />
      )}

      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-bold text-[#1a2332]">業務委託パートナー</h1>
          {!loading && (
            <span className="text-[11px] font-semibold bg-slate-100 text-[#5a6a7e] px-2 py-0.5 rounded-full">
              {partners.length}社
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-[#1e3a5f] hover:bg-[#16304f] rounded-lg transition-colors"
        >
          ＋ パートナーを追加
        </button>
      </div>

      <div className="p-8 max-w-5xl">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse bg-white border border-[#e2e6ec] rounded-xl h-28" />
            ))}
          </div>
        ) : partners.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-[40px] mb-3">🤝</div>
            <div className="text-[15px] font-bold text-[#1a2332] mb-1">パートナーが登録されていません</div>
            <div className="text-[13px] text-[#8f9db0] mb-5">外注先を登録すると発注書・請求書を発行できます</div>
            <button
              onClick={() => setShowNew(true)}
              className="text-[13px] font-semibold text-blue-600 hover:underline"
            >
              ＋ 最初のパートナーを追加
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map(p => (
              <Link
                key={p.id}
                href={`/partners/${p.id}`}
                className="bg-white border border-[#e2e6ec] rounded-xl px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-start gap-4 group"
              >
                <Avatar name={p.company_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold text-[#1a2332] group-hover:text-blue-700 transition-colors truncate">
                      {p.company_name}
                    </span>
                  </div>
                  {p.contact_name && (
                    <div className="text-[12px] text-[#5a6a7e] mb-1">{p.contact_name}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8f9db0]">
                    {p.email && <span>{p.email}</span>}
                    {p.phone && <span>{p.phone}</span>}
                    {p.standard_unit_price > 0 && (
                      <span>単価 {formatYen(p.standard_unit_price)}</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  {p.monthlyTotal > 0 ? (
                    <div>
                      <div className="text-[11px] text-[#8f9db0] mb-0.5">今月発注</div>
                      <div className="text-[13px] font-bold text-[#1a2332] font-mono">
                        {formatYen(p.monthlyTotal)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#8f9db0]">今月発注なし</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
