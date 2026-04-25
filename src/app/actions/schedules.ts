'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id, role').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null, role: u?.role ?? 'member' }
}

export type Schedule = {
  id: string
  title: string
  due_date: string
  amount: number | null
  status: string
  schedule_type: string
  notes: string | null
}

export async function getSchedules() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [], error: '未認証' }

  const { data, error } = await db
    .from('financial_schedules')
    .select('id, title, due_date, amount, status, schedule_type, notes')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Schedule[], error: null }
}

export async function createSchedule(input: {
  title: string
  due_date: string
  amount?: number | null
  schedule_type: string
  notes?: string | null
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('financial_schedules')
    .insert({
      tenant_id:     tenantId,
      title:         input.title,
      due_date:      input.due_date,
      amount:        input.amount ?? null,
      schedule_type: input.schedule_type,
      notes:         input.notes ?? null,
      status:        'pending',
    })

  if (error) return { error: error.message }
  revalidatePath('/schedules')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateScheduleStatus(id: string, status: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('financial_schedules')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/schedules')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteSchedule(id: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('financial_schedules')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/schedules')
  revalidatePath('/dashboard')
  return { success: true }
}
