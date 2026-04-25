'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getExpenseCategories, createExpense } from '@/app/actions/expenses'
import { cn } from '@/lib/utils'

interface Category { id: string; name: string; account_code: string }

// ─── スケルトン ────────────────────────────────────────────
function FieldSkeleton() {
  return <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
}

// ─── 成功画面 ─────────────────────────────────────────────
function SuccessView() {
  return (
    <div className="min-h-[calc(100vh-54px)] flex items-center justify-center bg-[#f4f6f9]">
      <div className="bg-white rounded-xl border border-[#e2e6ec] shadow-sm p-10 text-center max-w-sm w-full">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-[16px] font-bold text-[#1a2332] mb-2">申請が完了しました</div>
        <div className="text-[13px] text-[#8f9db0] leading-relaxed">
          管理者に通知が送信されました。<br />承認をお待ちください。
        </div>
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-[#8f9db0]">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
          </svg>
          経費一覧に移動します…
        </div>
      </div>
    </div>
  )
}

export default function NewExpensePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [categories,   setCategories]   = useState<Category[]>([])
  const [catLoading,   setCatLoading]   = useState(true)
  const [uploading,    setUploading]    = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [error,        setError]        = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [form, setForm] = useState({
    vendor_name:  '',
    amount:       '',
    expense_date: new Date().toISOString().slice(0, 10),
    category_id:  '',
    memo:         '',
  })

  useEffect(() => {
    getExpenseCategories()
      .then(res => setCategories(res.data ?? []))
      .finally(() => setCatLoading(false))
  }, [])

  // 成功後リダイレクト
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => router.push('/expenses'), 1800)
    return () => clearTimeout(t)
  }, [success, router])

  const taxAmt = form.amount ? Math.round(parseInt(form.amount) * 10 / 110) : 0

  function set(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.vendor_name.trim()) { setError('支払先を入力してください'); return }
    if (!form.amount || parseInt(form.amount) <= 0) { setError('金額を入力してください'); return }
    if (!form.expense_date) { setError('日付を入力してください'); return }

    let receipt_url: string | null = null

    if (file) {
      setUploading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id ?? 'unknown'
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${userId}/${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(path, file, { upsert: false })

      setUploading(false)

      if (uploadErr) {
        setError(`領収書のアップロードに失敗しました: ${uploadErr.message}`)
        return
      }
      receipt_url = path
    }

    startTransition(async () => {
      const res = await createExpense({
        vendor_name:  form.vendor_name.trim(),
        amount:       parseInt(form.amount),
        tax_amount:   taxAmt,
        expense_date: form.expense_date,
        category_id:  form.category_id || null,
        source:       'web',
        memo:         form.memo.trim() || undefined,
        receipt_url,
      })

      if (res.error) {
        setError(res.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) return <SuccessView />

  const isSubmitting = isPending || uploading

  return (
    <div>
      {/* Topbar */}
      <div className="bg-white border-b border-[#e2e6ec] px-8 h-[54px] flex items-center gap-4 sticky top-0 z-40">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5a6a7e] hover:text-[#1a2332] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <div className="w-px h-5 bg-[#e2e6ec]" />
        <h1 className="text-[16px] font-bold text-[#1a2332]">経費申請</h1>
      </div>

      <div className="p-8">
        <div className="max-w-2xl">
          <div className="bg-white border border-[#e2e6ec] rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-[#e2e6ec]">
              <div className="text-[14px] font-bold text-[#1a2332]">経費の詳細を入力</div>
              <div className="text-[12px] text-[#8f9db0] mt-0.5">申請後、管理者に通知が自動送信されます</div>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
                  {error}
                </div>
              )}

              {/* 支払先 */}
              <div>
                <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                  支払先 / 取引先 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.vendor_name}
                  onChange={e => set('vendor_name', e.target.value)}
                  required
                  autoFocus
                  placeholder="例: セブンイレブン 新宿駅前店"
                  className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-[13px] text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
                />
              </div>

              {/* 金額 + 日付 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                    金額（税込）<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#5a6a7e] pointer-events-none">¥</span>
                    <input
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={e => set('amount', e.target.value)}
                      required
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 border border-[#e2e6ec] rounded-lg text-[13px] text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
                    />
                  </div>
                  {taxAmt > 0 && (
                    <div className="mt-1 text-[11px] text-[#8f9db0]">
                      うち消費税（10%）: ¥{taxAmt.toLocaleString()}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                    支払日 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={e => set('expense_date', e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-[13px] text-[#1a2332] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
              </div>

              {/* カテゴリ */}
              <div>
                <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                  カテゴリ（勘定科目）
                </label>
                {catLoading ? (
                  <FieldSkeleton />
                ) : (
                  <div className="relative">
                    <select
                      value={form.category_id}
                      onChange={e => set('category_id', e.target.value)}
                      className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-[13px] text-[#1a2332] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors appearance-none bg-white pr-8"
                    >
                      <option value="">カテゴリを選択（任意）</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8f9db0] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                  備考・メモ
                </label>
                <textarea
                  value={form.memo}
                  onChange={e => set('memo', e.target.value)}
                  rows={3}
                  placeholder="例: 接待会食（○○様との商談）、出張先: 大阪梅田"
                  className="w-full px-3 py-2.5 border border-[#e2e6ec] rounded-lg text-[13px] text-[#1a2332] placeholder:text-[#c0c8d8] focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-blue-100 transition-colors resize-none"
                />
              </div>

              {/* 領収書アップロード */}
              <div>
                <label className="block text-[12px] font-semibold text-[#5a6a7e] mb-1.5">
                  領収書・レシート
                </label>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
                    file
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-[#e2e6ec] hover:border-[#2563eb] hover:bg-blue-50/30'
                  )}
                  onClick={() => document.getElementById('receipt-input')?.click()}
                >
                  <input
                    id="receipt-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mx-auto">
                        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-[13px] font-semibold text-blue-700 truncate max-w-xs mx-auto">{file.name}</div>
                      <div className="text-[11px] text-[#8f9db0]">{(file.size / 1024).toFixed(0)} KB</div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setFile(null) }}
                        className="text-[11px] text-red-500 hover:underline font-semibold"
                      >
                        削除する
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mx-auto">
                        <svg className="w-5 h-5 text-[#8f9db0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="text-[13px] text-[#5a6a7e] font-semibold">クリックしてアップロード</div>
                      <div className="text-[11px] text-[#8f9db0]">JPEG / PNG / WebP / PDF（最大 10 MB）</div>
                    </div>
                  )}
                </div>
              </div>

              {/* アクション */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e2e6ec]">
                <button
                  type="button"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-[13px] font-semibold text-[#5a6a7e] border border-[#e2e6ec] rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                      </svg>
                      アップロード中…
                    </>
                  ) : isPending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z"/>
                      </svg>
                      申請中…
                    </>
                  ) : (
                    '経費を申請する'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
