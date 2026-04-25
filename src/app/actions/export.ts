'use server'

import { createClient } from '@/lib/supabase/server'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

// ─── CSV エスケープ ───────────────────────────────────────
function esc(v: string | number | null | undefined): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

// ─── 税区分変換 ────────────────────────────────────────────
function toTaxType(raw: string | undefined | null): string {
  if (raw === 'taxed_8')  return '課税仕入8%（軽減）'
  if (raw === 'exempt')   return '非課税仕入'
  return '課税仕入10%'
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// マネーフォワード クラウド会計 — 仕訳インポート形式
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MF_HEADER = '取引日,借方勘定科目,借方補助科目,借方部門,借方税区分,借方金額（税込）,借方税額,貸方勘定科目,貸方補助科目,貸方部門,貸方税区分,貸方金額（税込）,貸方税額,摘要,タグ,メモ,決算整理仕訳,作成日時'

function mfRow(
  date: string,
  debitAcct: string, debitTax: string, debitAmt: number, debitTaxAmt: number,
  creditAcct: string, creditAmt: number,
  desc: string, memo = '',
): string {
  return [
    date, debitAcct, '', '', debitTax, debitAmt, debitTaxAmt,
    creditAcct, '', '', '対象外', creditAmt, 0,
    desc, '', memo, '', new Date().toISOString().slice(0, 10),
  ].map(esc).join(',')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// freee 会計 — 取引インポート形式（借方・貸方）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FREEE_HEADER = '取引日,借方勘定科目,借方補助科目,借方税区分,借方金額(税込),借方税額,貸方勘定科目,貸方補助科目,貸方税区分,貸方金額(税込),貸方税額,摘要,備考'

function freeeRow(
  date: string,
  debitAcct: string, debitTax: string, debitAmt: number, debitTaxAmt: number,
  creditAcct: string,
  desc: string, memo = '',
): string {
  return [
    date, debitAcct, '', debitTax, debitAmt, debitTaxAmt,
    creditAcct, '', '対象外', debitAmt, 0,
    desc, memo,
  ].map(esc).join(',')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 弥生会計 — 仕訳日記帳インポート形式
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const YAYOI_HEADER = '"伝票No.","決算","取引日付","借方勘定科目","借方補助科目","借方税区分","借方金額","借方消費税額","貸方勘定科目","貸方補助科目","貸方税区分","貸方金額","貸方消費税額","摘要"'

let yayoiSeq = 1

function yayoiRow(
  date: string,
  debitAcct: string, debitTax: string, debitAmt: number, debitTaxAmt: number,
  creditAcct: string,
  desc: string,
): string {
  // 弥生は YYYY/MM/DD 形式
  const yayoiDate = date.replace(/-/g, '/')
  // 弥生の税区分は「課税仕入（10%）」形式
  const yayoiTax = debitTax.replace('課税仕入10%', '課税仕入（10%）')
    .replace('課税仕入8%（軽減）', '課税仕入（8%）')
    .replace('非課税仕入', '非課税')
  return [
    yayoiSeq++, '', yayoiDate,
    debitAcct, '', yayoiTax, debitAmt, debitTaxAmt,
    creditAcct, '', '対象外', debitAmt, 0,
    desc,
  ].map(esc).join(',')
}

// ─── 型定義 ───────────────────────────────────────────────
export type ExportFormat = 'mf' | 'freee' | 'yayoi'
export type ExportStatus = 'approved' | 'all'

interface ExpenseRow {
  id: string
  expense_date: string
  vendor_name: string
  amount: number
  tax_amount: number
  memo: string | null
  status: string
  category: { name: string; account_code: string; tax_type: string | null } | null
}

// ─── プレビュー（件数取得） ───────────────────────────────
export async function getExportPreview(
  yearMonth: string,
  status: ExportStatus,
): Promise<{ count: number; totalAmount: number }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { count: 0, totalAmount: 0 }

  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)

  let query = db
    .from('expenses')
    .select('amount')
    .eq('tenant_id', tenantId)
    .gte('expense_date', start)
    .lte('expense_date', end)

  if (status === 'approved') query = query.eq('status', 'approved')

  const { data } = await query
  const rows = (data ?? []) as Array<{ amount: number }>
  const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0)
  return { count: rows.length, totalAmount }
}

// ─── メイン：経費 CSV エクスポート ───────────────────────
export async function exportExpensesCSV(
  yearMonth: string,
  status: ExportStatus,
  format: ExportFormat,
): Promise<{ csv: string; filename: string; count: number }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { csv: '', filename: '', count: 0 }

  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)

  let query = db
    .from('expenses')
    .select('id, expense_date, vendor_name, amount, tax_amount, memo, status, category:expense_categories(name, account_code, tax_type)')
    .eq('tenant_id', tenantId)
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date')

  if (status === 'approved') query = query.eq('status', 'approved')

  const { data } = await query
  const rows = (data ?? []) as ExpenseRow[]

  if (rows.length === 0) return { csv: '', filename: '', count: 0 }

  yayoiSeq = 1

  let header: string
  let bodyRows: string[]

  if (format === 'freee') {
    header = FREEE_HEADER
    bodyRows = rows.map(e => {
      const acct   = e.category?.name ?? '雑費'
      const taxStr = toTaxType(e.category?.tax_type)
      const taxAmt = Number(e.tax_amount) || 0
      const desc   = e.vendor_name + (e.memo ? ` ${e.memo}` : '')
      return freeeRow(e.expense_date, acct, taxStr, Number(e.amount), taxAmt, '未払金', desc)
    })
  } else if (format === 'yayoi') {
    header = YAYOI_HEADER
    bodyRows = rows.map(e => {
      const acct   = e.category?.name ?? '雑費'
      const taxStr = toTaxType(e.category?.tax_type)
      const taxAmt = Number(e.tax_amount) || 0
      const desc   = e.vendor_name + (e.memo ? ` ${e.memo}` : '')
      return yayoiRow(e.expense_date, acct, taxStr, Number(e.amount), taxAmt, '未払金', desc)
    })
  } else {
    // マネーフォワード (default)
    header = MF_HEADER
    bodyRows = rows.map(e => {
      const acct   = e.category?.name ?? '雑費'
      const taxStr = toTaxType(e.category?.tax_type)
      const taxAmt = Number(e.tax_amount) || 0
      const desc   = e.vendor_name
      const memo   = e.memo ?? ''
      return mfRow(e.expense_date, acct, taxStr, Number(e.amount), taxAmt, '未払金', Number(e.amount), desc, memo)
    })
  }

  const csv = [header, ...bodyRows].join('\r\n')
  const suffix = status === 'approved' ? 'approved' : 'all'
  const filename = `${format}_expenses_${yearMonth}_${suffix}.csv`

  return { csv, filename, count: rows.length }
}

// ─── 銀行取引 CSV エクスポート ────────────────────────────
export async function exportBankTransactionsCSV(
  yearMonth: string,
  format: ExportFormat,
): Promise<{ csv: string; filename: string; count: number }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { csv: '', filename: '', count: 0 }

  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)

  const { data } = await db
    .from('bank_transactions')
    .select('transaction_date, amount, direction, description')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date')

  const rows = (data ?? []) as Array<{ transaction_date: string; amount: number; direction: string; description: string }>
  if (rows.length === 0) return { csv: '', filename: '', count: 0 }

  yayoiSeq = 1

  let header: string
  let bodyRows: string[]

  if (format === 'freee') {
    header = FREEE_HEADER
    bodyRows = rows.map(t => {
      if (t.direction === 'in') {
        return freeeRow(t.transaction_date, '普通預金', '対象外', Number(t.amount), 0, '売上高', t.description)
      }
      return freeeRow(t.transaction_date, '雑費', '課税仕入10%', Number(t.amount), Math.round(t.amount * 10 / 110), '普通預金', t.description)
    })
  } else if (format === 'yayoi') {
    header = YAYOI_HEADER
    bodyRows = rows.map(t => {
      if (t.direction === 'in') {
        return yayoiRow(t.transaction_date, '普通預金', '対象外', Number(t.amount), 0, '売上高', t.description)
      }
      return yayoiRow(t.transaction_date, '雑費', '課税仕入10%', Number(t.amount), Math.round(t.amount * 10 / 110), '普通預金', t.description)
    })
  } else {
    header = MF_HEADER
    bodyRows = rows.map(t => {
      if (t.direction === 'in') {
        return mfRow(t.transaction_date, '普通預金', '対象外', Number(t.amount), 0, '売上高', Number(t.amount), t.description)
      }
      return mfRow(t.transaction_date, '雑費', '課税仕入10%', Number(t.amount), Math.round(t.amount * 10 / 110), '普通預金', Number(t.amount), t.description)
    })
  }

  const csv = [header, ...bodyRows].join('\r\n')
  return { csv, filename: `${format}_bank_${yearMonth}.csv`, count: rows.length }
}
