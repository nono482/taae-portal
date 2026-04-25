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

export interface MonthlyData {
  month: string   // 'YYYY-MM'
  label: string   // '4月'
  income: number  // bank_transactions in
  expense: number // expenses テーブル合計
  profit: number  // income - expense
}

export interface ExpenseBreakdown {
  category: string
  amount: number
  color: string
  pct: number
}

// ─── 月次レポートデータ ────────────────────────────────────
export async function getMonthlyReportData(months = 6): Promise<{
  monthly: MonthlyData[]
  breakdown: ExpenseBreakdown[]
  totals: { income: number; expense: number; profit: number; avgProfit: number }
  hasData: boolean
}> {
  const { db, tenantId } = await getCtx()

  const empty = {
    monthly:   [],
    breakdown: [],
    totals:    { income: 0, expense: 0, profit: 0, avgProfit: 0 },
    hasData:   false,
  }
  if (!tenantId) return empty

  // 対象期間を生成
  const now = new Date()
  const periods: Array<{ yearMonth: string; label: string; start: string; end: string }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const start = `${y}-${m}-01`
    const end = new Date(y, d.getMonth() + 1, 0).toISOString().slice(0, 10)
    periods.push({ yearMonth: `${y}-${m}`, label: `${d.getMonth() + 1}月`, start, end })
  }

  const globalStart = periods[0].start
  const globalEnd   = periods[periods.length - 1].end

  // 並列フェッチ
  const [expRes, txRes] = await Promise.all([
    // expenses テーブル — 全ステータスで月次経費トレンドを計算
    db
      .from('expenses')
      .select('amount, expense_date, status, category:expense_categories(name)')
      .eq('tenant_id', tenantId)
      .gte('expense_date', globalStart)
      .lte('expense_date', globalEnd),

    // bank_transactions — 入金のみ収益として扱う
    db
      .from('bank_transactions')
      .select('transaction_date, amount, direction')
      .eq('tenant_id', tenantId)
      .eq('direction', 'in')
      .gte('transaction_date', globalStart)
      .lte('transaction_date', globalEnd),
  ])

  const expList = (expRes.data ?? []) as Array<{
    amount: number
    expense_date: string
    status: string
    category: { name: string } | null
  }>
  const txList = (txRes.data ?? []) as Array<{ transaction_date: string; amount: number; direction: string }>

  if (expList.length === 0 && txList.length === 0) return empty

  // 月次集計
  const monthly: MonthlyData[] = periods.map(p => {
    const periodExp = expList.filter(e => e.expense_date >= p.start && e.expense_date <= p.end)
    const periodTx  = txList.filter(t => t.transaction_date >= p.start && t.transaction_date <= p.end)

    // 経費: 承認済み + 未承認（申請済み全件）を集計
    const expense = periodExp.reduce((s, e) => s + Number(e.amount), 0)
    const income  = periodTx.reduce((s, t) => s + Number(t.amount), 0)

    return {
      month: p.yearMonth,
      label: p.label,
      income,
      expense,
      profit: income - expense,
    }
  })

  // カテゴリ別内訳 — 承認済み経費のみ
  const approvedExp = expList.filter(e => e.status === 'approved')
  const catMap = new Map<string, number>()
  approvedExp.forEach(e => {
    const cat = e.category?.name ?? '未分類'
    catMap.set(cat, (catMap.get(cat) ?? 0) + Number(e.amount))
  })

  const totalApproved = Array.from(catMap.values()).reduce((s, v) => s + v, 0)
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']
  const breakdown: ExpenseBreakdown[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount], i) => ({
      category,
      amount,
      color: COLORS[i % COLORS.length],
      pct: totalApproved > 0 ? Math.round(amount / totalApproved * 100) : 0,
    }))

  const totals = monthly.reduce(
    (s, m) => ({
      income:  s.income  + m.income,
      expense: s.expense + m.expense,
      profit:  s.profit  + m.profit,
      avgProfit: 0,
    }),
    { income: 0, expense: 0, profit: 0, avgProfit: 0 },
  )
  totals.avgProfit = Math.round(totals.profit / (monthly.length || 1))

  return { monthly, breakdown, totals, hasData: true }
}
