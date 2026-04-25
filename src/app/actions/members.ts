'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

export type Member = {
  id: string
  name: string
  name_kana: string | null
  department: string | null
  position_title: string | null
  email: string | null
  phone: string | null
  hire_date: string | null
  base_salary: number
  dependents: number
  tax_table: string
  is_active: boolean
}

// ─── 従業員一覧 ───────────────────────────────────────────
export async function getMembers() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  const { data } = await db
    .from('employees')
    .select('id, name, name_kana, department, position_title, email, phone, hire_date, base_salary, dependents, tax_table, is_active')
    .eq('tenant_id', tenantId)
    .order('name')

  return { data: (data ?? []) as Member[] }
}

// ─── 従業員追加 ───────────────────────────────────────────
export async function createMember(input: {
  name: string
  name_kana?: string
  department?: string
  position_title?: string
  email?: string
  phone?: string
  hire_date?: string
  base_salary?: number
  dependents?: number
  tax_table?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db.from('employees').insert({
    tenant_id:      tenantId,
    name:           input.name,
    name_kana:      input.name_kana      || null,
    department:     input.department     || null,
    position_title: input.position_title || null,
    email:          input.email          || null,
    phone:          input.phone          || null,
    hire_date:      input.hire_date      || null,
    base_salary:    input.base_salary    ?? 0,
    dependents:     input.dependents     ?? 0,
    tax_table:      input.tax_table      ?? 'A',
    is_active:      true,
  })

  if (error) return { error: error.message }
  revalidatePath('/members')
  revalidatePath('/payroll')
  return { success: true }
}

// ─── 従業員更新 ───────────────────────────────────────────
export async function updateMember(id: string, input: Partial<Omit<Member, 'id'>>) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('employees')
    .update(input)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/members')
  revalidatePath('/payroll')
  return { success: true }
}
