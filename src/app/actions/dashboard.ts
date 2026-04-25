'use server'

import { createClient } from '@/lib/supabase/server'

export type DashboardExpense = {
  id: string
  amount: number
  status: string
  expense_date: string
  vendor_name: string
  source: string
  memo: string | null
  category: { name: string } | null
  submitter: { display_name: string } | null
}

export type DashboardNotification = {
  id: string
  category: string
  priority: string
  title: string
  body: string
  is_read: boolean
  action_href: string | null
  action_label: string | null
  created_at: string
}

export type DashboardSchedule = {
  id: string
  title: string
  due_date: string
  amount: number | null
  status: string
  schedule_type: string
}

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

  // ロール別経費クエリ
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

  const [expensesRes, employeesRes, payrollRes, bankTxRes, notifsRes, schedulesRes] = await Promise.all([
    expQuery,

    (supabase as any)
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true),

    (supabase as any)
      .from('payroll_records')
      .select('id, sent_at')
      .eq('pay_year_month', yearMonth),

    (supabase as any)
      .from('bank_transactions')
      .select('id, amount, direction')
      .eq('tenant_id', tenantId)
      .gte('transaction_date', monthStart)
      .lte('transaction_date', monthEnd),

    // 自分宛の最新通知 8 件（テーブル未作成時は空配列に fallback）
    (supabase as any)
      .from('notifications')
      .select('id, category, priority, title, body, is_read, action_href, action_label, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),

    // 未完了の税務・支払スケジュール（過去分も含め期日順）
    (supabase as any)
      .from('financial_schedules')
      .select('id, title, due_date, amount, status, schedule_type')
      .eq('tenant_id', tenantId)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(8),
  ])

  const expenses   = (expensesRes.data  ?? []) as DashboardExpense[]
  const employees  = (employeesRes.data ?? []) as Array<{ id: string }>
  const payrolls   = (payrollRes.data   ?? []) as Array<{ id: string; sent_at: string | null }>
  const bankTx     = (bankTxRes.data    ?? []) as Array<{ id: string; amount: number; direction: string }>
  const notifications      = (notifsRes.data    ?? []) as DashboardNotification[]
  const financialSchedules = (schedulesRes.data ?? []) as DashboardSchedule[]

  // KPI 計算
  const pendingExpenses = expenses.filter(e => e.status === 'pending')
  const pendingCount    = pendingExpenses.length
  const pendingAmount   = pendingExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const monthlyTotal    = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const approvedCount   = expenses.filter(e => e.status === 'approved').length
  const approvedAmount  = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0)

  const totalIncome  = bankTx.filter(t => t.direction === 'in').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = bankTx.filter(t => t.direction === 'out').reduce((s, t) => s + Number(t.amount), 0)
  const netProfit    = totalIncome - totalExpense

  // 銀行残高（行なしの場合は 0）
  const bankAccountRes = await (supabase as any)
    .from('bank_accounts')
    .select('balance')
    .eq('tenant_id', tenantId)
    .order('balance', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cashBalance = (bankAccountRes.data?.balance ?? 0) as number

  const sentCount  = payrolls.filter(p => p.sent_at).length
  const pendingPay = payrolls.length - sentCount

  // ダッシュボードテーブル: admin→未承認5件 / member→自分の直近5件
  const tableExpenses = isPrivileged
    ? pendingExpenses.slice(0, 5)
    : expenses.slice(0, 5)

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
    recentExpenses:    tableExpenses,
    payrollStatus:     { total: employees.length, sent: sentCount, pending: pendingPay },
    notifications,
    financialSchedules,
  }
}
