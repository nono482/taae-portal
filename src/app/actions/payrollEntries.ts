'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

function adminDb() { return createAdminClient() as any }

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, tenantId: null as string | null }
  const { data: u } = await adminDb().from('users').select('tenant_id').eq('id', user.id).single()
  return { user, tenantId: (u?.tenant_id ?? null) as string | null }
}

import type { PaymentType } from '@/constants/payroll'

export type PayrollEntry = {
  id:           string
  employee_id:  string
  payment_date: string
  payment_type: PaymentType
  amount:       number
  tax_amount:   number
  description:  string | null
  created_at:   string
  employee?:    { name: string; name_kana: string | null } | null
}

// ─── 一覧取得 ─────────────────────────────────────────────
export async function getPayrollEntries(yearMonth?: string) {
  const { tenantId } = await getCtx()
  if (!tenantId) return { data: [] as PayrollEntry[] }

  let q = adminDb()
    .from('payroll_entries')
    .select('id, employee_id, payment_date, payment_type, amount, tax_amount, description, created_at, employee:employees(name, name_kana)')
    .eq('tenant_id', tenantId)
    .order('payment_date', { ascending: false })

  if (yearMonth) {
    q = q.gte('payment_date', `${yearMonth}-01`)
         .lte('payment_date', `${yearMonth}-31`)
  }

  const { data, error } = await q
  if (error) { console.error('[payrollEntries] fetch error:', error.message); return { data: [] as PayrollEntry[] } }
  return { data: (data ?? []) as PayrollEntry[] }
}

// ─── 登録 ─────────────────────────────────────────────────
export async function createPayrollEntry(input: {
  employee_id:  string
  payment_date: string
  payment_type: PaymentType
  amount:       number
  tax_amount:   number
  description?: string
}) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await adminDb().from('payroll_entries').insert({
    tenant_id:    tenantId,
    employee_id:  input.employee_id,
    payment_date: input.payment_date,
    payment_type: input.payment_type,
    amount:       input.amount,
    tax_amount:   input.tax_amount,
    description:  input.description || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/payroll')
  return { success: true }
}

// ─── 削除 ─────────────────────────────────────────────────
export async function deletePayrollEntry(id: string) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await adminDb()
    .from('payroll_entries')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/payroll')
  return { success: true }
}
