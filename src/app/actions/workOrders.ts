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

export const WORK_ORDER_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  ordered:     { label: '発注済',   cls: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500'   },
  in_progress: { label: '進行中',   cls: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500'  },
  completed:   { label: '完了',     cls: 'bg-green-50 text-green-700',  dot: 'bg-green-500'  },
  cancelled:   { label: 'キャンセル', cls: 'bg-slate-50 text-slate-500', dot: 'bg-slate-400'  },
}

// ─── 発注一覧 ─────────────────────────────────────────────
export async function getWorkOrders(partnerId?: string) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  let q = db
    .from('work_orders')
    .select('*, partner:partners(company_name)')
    .eq('tenant_id', tenantId)
    .order('order_date', { ascending: false })

  if (partnerId) q = q.eq('partner_id', partnerId)

  const { data } = await q
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
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db.from('work_orders').insert({
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
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
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
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { error: '未認証' }

  const { error } = await db
    .from('work_orders')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/partners/${partnerId}`)
  return { success: true }
}
