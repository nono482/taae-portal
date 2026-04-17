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

// ─── MFクラウド 仕訳インポート形式 CSV ────────────────────
// ヘッダー: 取引日,借方勘定科目,借方補助科目,借方部門,借方税区分,借方金額（税込）,借方税額,貸方勘定科目,貸方補助科目,貸方部門,貸方税区分,貸方金額（税込）,貸方税額,摘要,タグ,メモ,決算整理仕訳,作成日時

const MF_HEADER = '取引日,借方勘定科目,借方補助科目,借方部門,借方税区分,借方金額（税込）,借方税額,貸方勘定科目,貸方補助科目,貸方部門,貸方税区分,貸方金額（税込）,貸方税額,摘要,タグ,メモ,決算整理仕訳,作成日時'

function escCsv(v: string | number) {
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function mfRow(
  date: string,
  debitAcct: string,  debitTax: string,  debitAmt: number,  debitTaxAmt: number,
  creditAcct: string, creditTax: string, creditAmt: number, creditTaxAmt: number,
  desc: string,       memo = '',
): string {
  return [
    date, debitAcct, '', '', debitTax, debitAmt, debitTaxAmt,
    creditAcct, '', '', creditTax, creditAmt, creditTaxAmt,
    desc, '', memo, '', new Date().toISOString(),
  ].map(escCsv).join(',')
}

// 税区分の変換
function taxType(taxType: string): string {
  if (taxType === 'taxed_10') return '課税仕入10%'
  if (taxType === 'taxed_8')  return '課税仕入8%（軽減）'
  return '非課税仕入'
}

// ─── 経費 CSV エクスポート ────────────────────────────────
export async function exportExpensesCSV(yearMonth: string): Promise<{ csv: string; filename: string }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { csv: '', filename: '' }

  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)

  const { data } = await db
    .from('expenses')
    .select('*, category:expense_categories(name, account_code, tax_type)')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date')

  const rows = (data ?? []).map((e: any) => {
    const acctName = e.category?.name ?? '雑費'
    const tt = taxType(e.category?.tax_type ?? 'taxed_10')
    const taxAmt = e.tax_amount ?? 0
    return mfRow(
      e.expense_date,
      acctName, tt, e.amount, taxAmt,
      '未払金',  '対象外', e.amount, 0,
      e.vendor_name,
      e.memo ?? '',
    )
  })

  const csv = [MF_HEADER, ...rows].join('\n')
  return { csv, filename: `mf_expenses_${yearMonth}.csv` }
}

// ─── 銀行取引 CSV エクスポート ────────────────────────────
export async function exportBankTransactionsCSV(yearMonth: string): Promise<{ csv: string; filename: string }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { csv: '', filename: '' }

  const [y, m] = yearMonth.split('-')
  const start = `${y}-${m}-01`
  const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)

  const { data } = await db
    .from('bank_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .order('transaction_date')

  const rows = (data ?? []).map((t: any) => {
    if (t.direction === 'in') {
      return mfRow(
        t.transaction_date,
        '普通預金', '対象外', t.amount, 0,
        '売上高',   '課税売上10%', t.amount, 0,
        t.description,
      )
    } else {
      return mfRow(
        t.transaction_date,
        '雑費',     '課税仕入10%', t.amount, Math.round(t.amount * 10 / 110),
        '普通預金', '対象外', t.amount, 0,
        t.description,
      )
    }
  })

  const csv = [MF_HEADER, ...rows].join('\n')
  return { csv, filename: `mf_bank_${yearMonth}.csv` }
}

// ─── 給与 CSV エクスポート ────────────────────────────────
export async function exportPayrollCSV(yearMonth: string): Promise<{ csv: string; filename: string }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { csv: '', filename: '' }

  const { data } = await db
    .from('payroll_records')
    .select('*, employee:employees(name)')
    .eq('tenant_id', tenantId)
    .eq('pay_year_month', yearMonth)

  const rows = (data ?? []).map((p: any) => {
    const name = p.employee?.name ?? '従業員'
    const gross = p.base_salary + (p.allowances ?? 0)
    const rows2: string[] = []
    // 給与
    rows2.push(mfRow(
      `${yearMonth}-25`,
      '給料賃金', '対象外', gross, 0,
      '未払費用', '対象外', gross, 0,
      `給与 ${name} ${yearMonth}`,
    ))
    // 社会保険
    const socialIns = (p.health_ins ?? 0) + (p.pension_ins ?? 0) + (p.employment_ins ?? 0)
    if (socialIns > 0) {
      rows2.push(mfRow(
        `${yearMonth}-25`,
        '法定福利費', '対象外', socialIns, 0,
        '未払費用',  '対象外', socialIns, 0,
        `社会保険料（会社負担）${name}`,
      ))
    }
    return rows2.join('\n')
  })

  const csv = [MF_HEADER, ...rows].join('\n')
  return { csv, filename: `mf_payroll_${yearMonth}.csv` }
}

// ─── 統合エクスポート ─────────────────────────────────────
export async function exportAll(yearMonth: string, types: string[]): Promise<{ csv: string; filename: string }> {
  const parts: string[] = []

  if (types.includes('expenses')) {
    const { csv } = await exportExpensesCSV(yearMonth)
    if (csv) parts.push(csv.split('\n').slice(1).join('\n')) // ヘッダーを除く
  }
  if (types.includes('bank')) {
    const { csv } = await exportBankTransactionsCSV(yearMonth)
    if (csv) parts.push(csv.split('\n').slice(1).join('\n'))
  }
  if (types.includes('payroll')) {
    const { csv } = await exportPayrollCSV(yearMonth)
    if (csv) parts.push(csv.split('\n').slice(1).join('\n'))
  }

  const allRows = parts.filter(Boolean).join('\n')
  const csv = [MF_HEADER, allRows].join('\n')
  return { csv, filename: `mf_all_${yearMonth}.csv` }
}
