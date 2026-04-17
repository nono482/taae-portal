'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDashboardData() {
  const supabase = await createClient()

  const now        = new Date()
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${yearMonth}-01`
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().slice(0, 10)

  // 並列フェッチ
  const [expensesRes, employeesRes, payrollRes, bankTxRes] = await Promise.all([
    // 経費
    supabase
      .from('expenses')
      .select('id, amount, status, expense_date, vendor_name, source, category:expense_categories(name)')
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd)
      .order('expense_date', { ascending: false }),

    // 従業員数
    supabase
      .from('employees')
      .select('id, name', { count: 'exact' })
      .eq('is_active', true),

    // 給与明細（今月）
    supabase
      .from('payroll_records')
      .select('id, employee_id, net_pay, sent_at')
      .eq('pay_year_month', yearMonth),

    // 銀行取引（今月）
    supabase
      .from('bank_transactions')
      .select('id, amount, direction, transaction_date, description')
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd)
      .order('transaction_date', { ascending: false }),
  ])

  const expenses  = (expensesRes.data  ?? []) as Array<{ id: string; amount: number; status: string; expense_date: string; vendor_name: string; source: string; category: { name: string } | null }>
  const employees = (employeesRes.data ?? []) as Array<{ id: string; name: string }>
  const payrolls  = (payrollRes.data   ?? []) as Array<{ id: string; employee_id: string; net_pay: number; sent_at: string | null }>
  const bankTx    = (bankTxRes.data    ?? []) as Array<{ id: string; amount: number; direction: string; transaction_date: string; description: string }>

  // KPI 計算
  const pendingExpenses  = expenses.filter(e => e.status === 'pending')
  const pendingCount     = pendingExpenses.length
  const pendingAmount    = pendingExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const totalIncome  = bankTx.filter(t => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = bankTx.filter(t => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
  const netProfit    = totalIncome - totalExpense

  // 最新の口座残高
  const bankAccountRes = await supabase
    .from('bank_accounts')
    .select('balance, bank_name, last_synced_at')
    .order('balance', { ascending: false })
    .limit(1)
    .single()

  const bankAccountData = bankAccountRes.data as { balance: number; bank_name: string; last_synced_at: string | null } | null
  const cashBalance = bankAccountData?.balance ?? 0

  // 給与送信状況
  const sentCount    = payrolls.filter(p => p.sent_at).length
  const pendingPay   = payrolls.length - sentCount

  return {
    kpi: {
      netProfit,
      cashBalance,
      totalIncome,
      totalExpense,
      pendingExpenseCount:  pendingCount,
      pendingExpenseAmount: pendingAmount,
    },
    recentExpenses:   expenses.slice(0, 5),
    payrollStatus:    { total: employees.length, sent: sentCount, pending: pendingPay },
    recentBankTx:     bankTx.slice(0, 6),
    hasRealData:      expenses.length > 0 || bankTx.length > 0,
  }
}
