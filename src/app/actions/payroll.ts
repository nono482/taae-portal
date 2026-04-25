'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calculatePayroll } from '@/lib/payrollCalculator'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

// ─── 給与データ取得 ───────────────────────────────────────
export async function getPayrollData(yearMonth: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { employees: [], records: [] }

  const [empRes, recRes] = await Promise.all([
    db.from('employees')
      .select('id, name, name_kana, base_salary, dependents, tax_table, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),
    db.from('payroll_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('pay_year_month', yearMonth),
  ])

  return {
    employees: empRes.data ?? [],
    records:   recRes.data ?? [],
  }
}

// ─── 給与明細レコードを作成/更新 ─────────────────────────
export async function ensurePayrollRecords(yearMonth: string) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { data: existing } = await db
    .from('payroll_records')
    .select('id, employee_id, base_salary, allowances, residence_tax')
    .eq('tenant_id', tenantId)
    .eq('pay_year_month', yearMonth)

  const { data: employees } = await db
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!employees || employees.length === 0) return { error: '従業員が登録されていません' }

  type ExistingRec = { id: string; employee_id: string; base_salary: number; allowances: number; residence_tax: number }
  const existingMap = new Map<string, ExistingRec>(
    (existing ?? []).map((r: any) => [r.employee_id as string, r as ExistingRec])
  )

  // 新規作成が必要な従業員
  const toCreate = (employees as any[]).filter(e => !existingMap.has(e.id))

  // base_salary が変わった既存レコードを更新
  const toUpdate = (employees as any[]).filter(e => {
    const rec = existingMap.get(e.id)
    return rec && Number(rec.base_salary) !== Number(e.base_salary)
  })

  // 新規レコード作成
  if (toCreate.length > 0) {
    const records = toCreate.map((emp: any) => {
      const result = calculatePayroll({
        baseSalary:   emp.base_salary,
        allowances:   0,
        dependents:   emp.dependents ?? 0,
        taxTable:     (emp.tax_table ?? 'A') as 'A' | 'B',
        age:          30,
        residenceTax: 0,
      })
      return {
        tenant_id:      tenantId,
        employee_id:    emp.id,
        pay_year_month: yearMonth,
        base_salary:    emp.base_salary,
        allowances:     0,
        health_ins:     result.healthIns + result.nursingIns,
        pension_ins:    result.pensionIns,
        employment_ins: result.employmentIns,
        income_tax:     result.incomeTax,
        residence_tax:  0,
        net_pay:        result.netPay,
      }
    })
    const { error } = await db.from('payroll_records').insert(records)
    if (error) return { error: error.message }
  }

  // 基本給が変わったレコードを更新（手当・住民税は保持）
  for (const emp of toUpdate as any[]) {
    const rec = existingMap.get(emp.id)!
    const result = calculatePayroll({
      baseSalary:   emp.base_salary,
      allowances:   Number(rec.allowances)    || 0,
      dependents:   emp.dependents            ?? 0,
      taxTable:     (emp.tax_table            ?? 'A') as 'A' | 'B',
      age:          30,
      residenceTax: Number(rec.residence_tax) || 0,
    })
    const { error } = await db.from('payroll_records').update({
      base_salary:    emp.base_salary,
      health_ins:     result.healthIns + result.nursingIns,
      pension_ins:    result.pensionIns,
      employment_ins: result.employmentIns,
      income_tax:     result.incomeTax,
      net_pay:        result.netPay,
    }).eq('id', rec.id)
    if (error) return { error: error.message }
  }

  revalidatePath('/payroll')
  return { success: true, created: toCreate.length, updated: toUpdate.length }
}

// ─── 給与明細を「送信済」にマーク ─────────────────────────
export async function markPayrollSent(payrollIds: string[]) {
  const { db, user } = await getCtx()
  if (!user) return { error: '未認証' }

  const { error } = await db
    .from('payroll_records')
    .update({ sent_at: new Date().toISOString() })
    .in('id', payrollIds)

  if (error) return { error: error.message }
  revalidatePath('/payroll')
  return { success: true }
}

// ─── 全員を「送信済」にマーク ─────────────────────────────
export async function markAllPayrollSent(yearMonth: string) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await db
    .from('payroll_records')
    .update({ sent_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('pay_year_month', yearMonth)
    .is('sent_at', null)

  if (error) return { error: error.message }
  revalidatePath('/payroll')
  return { success: true }
}

// ─── 従業員を追加 ─────────────────────────────────────────
export async function createEmployee(input: {
  name: string
  name_kana: string
  email: string
  base_salary: number
  dependents: number
  hire_date: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db.from('employees').insert({
    tenant_id:   tenantId,
    name:        input.name,
    name_kana:   input.name_kana,
    email:       input.email,
    base_salary: input.base_salary,
    dependents:  input.dependents,
    tax_table:   'A',
    hire_date:   input.hire_date,
    is_active:   true,
  })

  if (error) return { error: error.message }
  revalidatePath('/payroll')
  return { success: true }
}
