'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { WORK_ORDER_STATUS } from '@/lib/constants'

function adminDb() { return createAdminClient() as any }

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, tenantId: null }
  const { data: u } = await adminDb().from('users').select('tenant_id').eq('id', user.id).single()
  return { user, tenantId: (u?.tenant_id ?? null) as string | null }
}

export type WorkOrder = {
  id: string
  partner_id: string
  title: string
  description: string | null
  order_date: string
  delivery_date: string | null
  amount: number
  status: string
  notes: string | null
  created_at: string
  partner?: { company_name: string } | null
}

// ─── 発注一覧 ─────────────────────────────────────────────
export async function getWorkOrders(partnerId?: string) {
  const { tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = adminDb()
    .from('work_orders')
    .select('id, partner_id, title, description, order_date, delivery_date, amount, status, notes, created_at')
    .eq('tenant_id', tenantId)
    .order('order_date', { ascending: false })

  if (partnerId) q = q.eq('partner_id', partnerId)

  const { data, error } = await q
  if (error) { console.error('[workOrders] getWorkOrders error:', error.message); return { data: [] } }
  return { data: (data ?? []) as WorkOrder[] }
}

// ─── 発注作成 ─────────────────────────────────────────────
export async function createWorkOrder(input: {
  partner_id: string
  title: string
  description?: string
  order_date: string
  delivery_date?: string
  amount: number
  notes?: string
}) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await adminDb().from('work_orders').insert({
    tenant_id:     tenantId,
    partner_id:    input.partner_id,
    title:         input.title,
    description:   input.description   || null,
    order_date:    input.order_date,
    delivery_date: input.delivery_date || null,
    amount:        input.amount,
    status:        'ordered',
    notes:         input.notes         || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/partners')
  revalidatePath(`/partners/${input.partner_id}`)
  return { success: true }
}

// ─── ステータス更新 ───────────────────────────────────────
export async function updateWorkOrderStatus(id: string, status: string, partnerId: string) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await adminDb()
    .from('work_orders')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}`)
  return { success: true }
}

// ─── 削除 ─────────────────────────────────────────────────
export async function deleteWorkOrder(id: string, partnerId: string) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await adminDb()
    .from('work_orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}`)
  return { success: true }
}
