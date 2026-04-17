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

// ─── 委託先一覧 ──────────────────────────────────────────
export async function getContractors() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  const { data } = await db
    .from('contractors')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')

  return { data: data ?? [] }
}

// ─── 請求書一覧 ──────────────────────────────────────────
export async function getContractorInvoices(yearMonth?: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = db
    .from('contractor_invoices')
    .select('*, contractor:contractors(id, name, withholding_rate)')
    .eq('tenant_id', tenantId)
    .order('invoice_date', { ascending: false })

  if (yearMonth) {
    const [y, m] = yearMonth.split('-')
    const start = `${y}-${m}-01`
    const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)
    q = q.gte('invoice_date', start).lte('invoice_date', end)
  }

  const { data } = await q
  return { data: data ?? [] }
}

// ─── 委託先を追加 ────────────────────────────────────────
export async function createContractor(input: {
  name: string
  email: string
  withholding_rate?: number
  invoice_transition?: boolean
  invoice_number?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db.from('contractors').insert({
    tenant_id:           tenantId,
    name:                input.name,
    email:               input.email,
    withholding_rate:    input.withholding_rate ?? 0.1021,
    invoice_transition:  input.invoice_transition ?? false,
    invoice_number:      input.invoice_number ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/contractors')
  return { success: true }
}

// ─── 請求書を追加 ────────────────────────────────────────
export async function createInvoice(input: {
  contractor_id: string
  invoice_date: string
  gross_amount: number
  memo?: string
}) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  // 委託先の源泉徴収率を取得
  const { data: contractor } = await db
    .from('contractors')
    .select('withholding_rate')
    .eq('id', input.contractor_id)
    .single()

  const rate = contractor?.withholding_rate ?? 0.1021
  const withholdingTax = Math.floor(input.gross_amount * rate)
  const netPayment = input.gross_amount - withholdingTax

  const { error } = await db.from('contractor_invoices').insert({
    tenant_id:          tenantId,
    contractor_id:      input.contractor_id,
    invoice_date:       input.invoice_date,
    gross_amount:       input.gross_amount,
    withholding_tax:    withholdingTax,
    transition_deduction: 0,
    net_payment:        netPayment,
    status:             'pending',
    memo:               input.memo ?? null,
  })

  if (error) return { error: error.message }
  revalidatePath('/contractors')
  return { success: true }
}

// ─── 請求書ステータス更新 ────────────────────────────────
export async function updateInvoiceStatus(
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
  revalidatePath('/contractors')
  return { success: true }
}
