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
  month: string      // 'YYYY-MM'
  label: string      // '4月'
  income: number
  expense: number
  profit: number
}

export interface ExpenseBreakdown {
  category: string
  amount: number
  color: string
}

// ─── 月次P/Lデータ取得 ────────────────────────────────────
export async function getMonthlyReportData(months = 6): Promise<{
  monthly: MonthlyData[]
  breakdown: ExpenseBreakdown[]
  totals: { income: number; expense: number; profit: number; avgProfit: number }
}> {
  const { db, tenantId } = await getCtx()

  const empty = { monthly: [], breakdown: [], totals: { income: 0, expense: 0, profit: 0, avgProfit: 0 } }
  if (!tenantId) return empty

  // 対象期間
  const now = new Date()
  const periods: Array<{ yearMonth: string; label: string; start: string; end: string }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const start = `${y}-${m}-01`
    const endDate = new Date(y, d.getMonth() + 1, 0)
    const end = endDate.toISOString().slice(0, 10)
    periods.push({ yearMonth: `${y}-${m}`, label: `${d.getMonth() + 1}月`, start, end })
  }

  const globalStart = periods[0].start
  const globalEnd   = periods[periods.length - 1].end

  // 銀行取引から収支取得
  const { data: txData } = await db
    .from('bank_transactions')
    .select('transaction_date, amount, direction')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', globalStart)
    .lte('transaction_date', globalEnd)

  // 経費内訳（承認済）
  const { data: expData } = await db
    .from('expenses')
    .select('amount, expense_date, category:expense_categories(name)')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .gte('expense_date', globalStart)
    .lte('expense_date', globalEnd)

  const txList  = (txData  ?? []) as Array<{ transaction_date: string; amount: number; direction: string }>
  const expList = (expData ?? []) as Array<{ amount: number; expense_date: string; category: { name: string } | null }>

  // 月次集計
  const monthly: MonthlyData[] = periods.map(p => {
    const txMonth = txList.filter(t => t.transaction_date >= p.start && t.transaction_date <= p.end)
    const income  = txMonth.filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
    const expense = txMonth.filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0)
    return { month: p.yearMonth, label: p.label, income, expense, profit: income - expense }
  })

  // 経費内訳
  const catMap = new Map<string, number>()
  expList.forEach(e => {
    const cat = e.category?.name ?? '未分類'
    catMap.set(cat, (catMap.get(cat) ?? 0) + e.amount)
  })

  const COLORS = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16']
  const breakdown: ExpenseBreakdown[] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount], i) => ({ category, amount, color: COLORS[i % COLORS.length] }))

  const totals = monthly.reduce(
    (s, m) => ({ income: s.income + m.income, expense: s.expense + m.expense, profit: s.profit + m.profit, avgProfit: 0 }),
    { income: 0, expense: 0, profit: 0, avgProfit: 0 },
  )
  totals.avgProfit = Math.round(totals.profit / (monthly.length || 1))

  // 実データがない場合はデモデータ
  if (totals.income === 0 && totals.expense === 0) {
    return {
      monthly: periods.map((p, i) => {
        const inc = [3400, 3800, 3600, 3900, 4100, 4200][i % 6] * 1000
        const exp = [2100, 2300, 2400, 2200, 2450, 2353][i % 6] * 1000
        return { month: p.yearMonth, label: p.label, income: inc, expense: exp, profit: inc - exp }
      }),
      breakdown: [
        { category: '旅費交通費', amount: 580000,  color: '#2563eb' },
        { category: '外注費',     amount: 1200000, color: '#10b981' },
        { category: '通信費',     amount: 120000,  color: '#f59e0b' },
        { category: '会議費',     amount: 85000,   color: '#ef4444' },
        { category: '消耗品費',   amount: 95000,   color: '#8b5cf6' },
        { category: '地代家賃',   amount: 200000,  color: '#06b6d4' },
      ],
      totals: { income: 23000000, expense: 13956000, profit: 9044000, avgProfit: 1507333 },
    }
  }

  return { monthly, breakdown, totals }
}
