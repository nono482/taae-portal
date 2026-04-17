'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ScheduleType, ScheduleStatus } from '@/lib/supabase/types'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

// ─── 委託先一覧（選択肢用） ──────────────────────────────
export async function getContractorsForSelect() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  const { data } = await db
    .from('contractors')
    .select('id, name, withholding_rate, invoice_transition')
    .eq('tenant_id', tenantId)
    .order('name')

  return { data: data ?? [] }
}

// ─── 請求書一覧 ──────────────────────────────────────────
export async function getOutsourcingInvoices(yearMonth?: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = db
    .from('contractor_invoices')
    .select('*, contractor:contractors(id, name, withholding_rate, invoice_transition)')
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false })

  if (yearMonth) {
    const [y, m] = yearMonth.split('-')
    const start = `${y}-${m}-01`
    const end   = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)
    q = q.gte('invoice_date', start).lte('invoice_date', end)
  }

  const { data } = await q
  return { data: data ?? [] }
}

// ─── 請求書を登録 ────────────────────────────────────────
export async function createOutsourcingInvoice(input: {
  contractor_id: string
  invoice_date: string
  gross_amount: number
  memo?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { data: contractor } = await db
    .from('contractors')
    .select('withholding_rate, invoice_transition')
    .eq('id', input.contractor_id)
    .single()

  const rate             = contractor?.withholding_rate ?? 0.1021
  const withholdingTax   = Math.floor(input.gross_amount * rate)
  const transDeduction   = contractor?.invoice_transition
    ? Math.floor(withholdingTax * 0.02)
    : 0
  const netPayment       = input.gross_amount - withholdingTax + transDeduction

  const { error } = await db.from('contractor_invoices').insert({
    tenant_id:            tenantId,
    contractor_id:        input.contractor_id,
    invoice_date:         input.invoice_date,
    gross_amount:         input.gross_amount,
    withholding_tax:      withholdingTax,
    transition_deduction: transDeduction,
    net_payment:          netPayment,
    status:               'pending',
    memo:                 input.memo ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/outsourcing')
  return { success: true }
}

// ─── 請求書ステータス更新 ────────────────────────────────
export async function updateOutsourcingInvoiceStatus(
  invoiceId: string,
  status: 'pending' | 'approved' | 'paid' | 'cancelled',
) {
  const { db, user } = await getCtx()
  if (!user) return { error: '未認証' }

  const updates: Record<string, unknown> = { status }
  if (status === 'paid') updates.paid_at = new Date().toISOString()

  const { error } = await db
    .from('contractor_invoices')
    .update(updates)
    .eq('id', invoiceId)

  if (error) return { error: error.message }
  revalidatePath('/outsourcing')
  return { success: true }
}

// ─── スケジュール一覧 ────────────────────────────────────
export async function getFinancialSchedules(status?: ScheduleStatus) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = db
    .from('financial_schedules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('due_date', { ascending: true })

  if (status) q = q.eq('status', status)

  const { data } = await q
  return { data: data ?? [] }
}

// ─── スケジュールを登録 ──────────────────────────────────
export async function createFinancialSchedule(input: {
  schedule_type: ScheduleType
  title: string
  due_date: string
  amount?: number
  related_id?: string
  related_table?: string
  memo?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db.from('financial_schedules').insert({
    tenant_id:     tenantId,
    schedule_type: input.schedule_type,
    title:         input.title,
    due_date:      input.due_date,
    amount:        input.amount ?? null,
    related_id:    input.related_id ?? null,
    related_table: input.related_table ?? null,
    status:        'pending',
    memo:          input.memo ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/outsourcing')
  return { success: true }
}

// ─── スケジュールを完了にする ────────────────────────────
export async function completeFinancialSchedule(id: string) {
  const { db, user } = await getCtx()
  if (!user) return { error: '未認証' }

  const { error } = await db
    .from('financial_schedules')
    .update({ status: 'completed' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/outsourcing')
  return { success: true }
}
