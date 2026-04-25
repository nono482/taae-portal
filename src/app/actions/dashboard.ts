'use server'

import { createClient } from '@/lib/supabase/server'

export async function getDashboardData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userRecord } = await (supabase as any)
    .from('users')
    .select('tenant_id, role, display_name')
    .eq('id', user.id)
    .single()

  const tenantId    = userRecord?.tenant_id as string | null
  const role        = (userRecord?.role ?? 'member') as string
  const displayName = (userRecord?.display_name ?? '') as string

  if (!tenantId) return null

  const isPrivileged = role === 'admin' || role === 'accountant'

  const now        = new Date()
  const yearMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${yearMonth}-01`
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  // 経費クエリ（ロールによって絞り込み変わる）
  let expQuery = (supabase as any)
    .from('expenses')
    .select('id, amount, status, expense_date, vendor_name, source, memo, category:expense_categories(name), submitter:users!submitted_by(display_name)')
    .eq('tenant_id', tenantId)
    .gte('expense_date', monthStart)
    .lte('expense_date', monthEnd)
    .order('expense_date', { ascending: false })

  if (!isPrivileged) {
    expQuery = expQuery.eq('submitted_by', user.id)
  }

  const [expensesRes, employeesRes, payrollRes, bankTxRes] = await Promise.all([
    expQuery,
    (supabase as any).from('employees').select('id, name', { count: 'exact' }).eq('is_active', true),
    (supabase as any).from('payroll_records').select('id, employee_id, net_pay, sent_at').eq('pay_year_month', yearMonth),
    (supabase as any)
      .from('bank_transactions')
      .select('id, amount, direction, transaction_date, description')
      .eq('tenant_id', tenantId)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd)
      .order('transaction_date', { ascending: false }),
  ])

  const expenses  = (expensesRes.data  ?? []) as Array<{ id: string; amount: number; status: string; expense_date: string; vendor_name: string; source: string; memo: string | null; category: { name: string } | null; submitter: { display_name: string } | null }>
  const employees = (employeesRes.data ?? []) as Array<{ id: string; name: string }>
  const payrolls  = (payrollRes.data   ?? []) as Array<{ id: string; employee_id: string; net_pay: number; sent_at: string | null }>
  const bankTx    = (bankTxRes.data    ?? []) as Array<{ id: string; amount: number; direction: string; transaction_date: string; description: string }>

  const pendingExpenses = expenses.filter(e => e.status === 'pending')
  const pendingCount    = pendingExpenses.length
  const pendingAmount   = pendingExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const totalIncome  = bankTx.filter(t => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = bankTx.filter(t => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
  const netProfit    = totalIncome - totalExpense

  const bankAccountRes = await (supabase as any)
    .from('bank_accounts')
    .select('balance, bank_name, last_synced_at')
    .eq('tenant_id', tenantId)
    .order('balance', { ascending: false })
    .limit(1)
    .single()

  const cashBalance = (bankAccountRes.data?.balance ?? 0) as number

  const sentCount  = payrolls.filter(p => p.sent_at).length
  const pendingPay = payrolls.length - sentCount

  // ダッシュボードテーブル用: admin→未承認のみ5件, member→自分の直近5件
  const tableExpenses = isPrivileged
    ? pendingExpenses.slice(0, 5)
    : expenses.slice(0, 5)

  // 月間合計（自分の申請 or テナント全体）
  const monthlyTotal    = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const approvedCount   = expenses.filter(e => e.status === 'approved').length
  const approvedAmount  = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0)

  return {
    role,
    displayName,
    userId: user.id,
    isPrivileged,
    kpi: {
      netProfit,
      cashBalance,
      totalIncome,
      totalExpense,
      pendingExpenseCount:  pendingCount,
      pendingExpenseAmount: pendingAmount,
      monthlyTotal,
      approvedCount,
      approvedAmount,
    },
    recentExpenses:  tableExpenses,
    payrollStatus:   { total: employees.length, sent: sentCount, pending: pendingPay },
    recentBankTx:    bankTx.slice(0, 6),
    hasRealData:     expenses.length > 0 || bankTx.length > 0,
  }
}
