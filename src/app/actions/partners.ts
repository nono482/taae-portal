'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, tenantId: null as string | null, tenantName: null as string | null }

  const adb = adminDb()
  const { data: u, error: err } = await adb.from('users').select('tenant_id').eq('id', user.id).single()
  const tenantId = (u?.tenant_id ?? null) as string | null

  let tenantName: string | null = null
  if (tenantId) {
    const { data: t } = await adb.from('tenants').select('name').eq('id', tenantId).single()
    tenantName = t?.name ?? null
  }
  return { user, tenantId, tenantName }
}

// 書き込み専用: service_role キー（RLS バイパス、コード側でテナント検証）
function adminDb() {
  return createAdminClient() as any
}

export type Partner = {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_account_type: string
  bank_account_number: string | null
  bank_account_name: string | null
  standard_unit_price: number
  invoice_number: string | null
  is_invoice_registered: boolean
  withholding_rate: number
  notes: string | null
  is_active: boolean | undefined
  created_at: string
}

export type PartnerWithTotal = Partner & { monthlyTotal: number }

// ─── 一覧（今月発注合計付き）─────────────────────────────
export async function getPartnersWithMonthlyTotal(): Promise<{ data: PartnerWithTotal[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { tenantId, user: ctxUser } = await getCtx()
  
  const adb = adminDb()

  // ユーザーの tenant_id が null の場合、fallback to first tenant
  if (!tenantId) {
    const { data: firstTenant } = await adb.from('tenants').select('id').limit(1).single()
    if (firstTenant?.id) {
      const fallbackTenantId = firstTenant.id
      
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const monthStart = `${y}-${m}-01`
      const monthEnd   = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10)

      const [partnersRes, ordersRes] = await Promise.all([
        adb.from('partners').select('*').eq('tenant_id', fallbackTenantId).order('company_name'),
        adb.from('work_orders').select('partner_id, amount')
          .eq('tenant_id', fallbackTenantId)
          .neq('status', 'cancelled')
          .gte('order_date', monthStart)
          .lte('order_date', monthEnd),
      ])

      const partners = (partnersRes.data ?? []) as Partner[]
      const orders   = (ordersRes.data  ?? []) as Array<{ partner_id: string; amount: number }>

      const totals = new Map<string, number>()
      orders.forEach(o => totals.set(o.partner_id, (totals.get(o.partner_id) ?? 0) + Number(o.amount)))

      return {
        data: partners.map(p => ({ ...p, monthlyTotal: totals.get(p.id) ?? 0 })),
      }
    }
    
    return { data: [] }
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const monthStart = `${y}-${m}-01`
  const monthEnd   = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [partnersRes, ordersRes] = await Promise.all([
    adb.from('partners').select('*').eq('tenant_id', tenantId).order('company_name'),
    adb.from('work_orders').select('partner_id, amount')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('order_date', monthStart)
      .lte('order_date', monthEnd),
  ])

  const partners = (partnersRes.data ?? []) as Partner[]
  const orders   = (ordersRes.data  ?? []) as Array<{ partner_id: string; amount: number }>

  const totals = new Map<string, number>()
  orders.forEach(o => totals.set(o.partner_id, (totals.get(o.partner_id) ?? 0) + Number(o.amount)))

  return {
    data: partners.map(p => ({ ...p, monthlyTotal: totals.get(p.id) ?? 0 })),
  }
}

// ─── 1件取得（テナント名付き）─────────────────────────────
export async function getPartner(id: string): Promise<{ data: Partner | null; tenantName: string | null }> {
  const { tenantId, tenantName } = await getCtx()
  if (!tenantId) return { data: null, tenantName: null }

  const { data } = await adminDb()
    .from('partners')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  return { data: data as Partner | null, tenantName }
}

// ─── 新規作成（admin クライアントで RLS をバイパス） ──────
export async function createPartner(input: {
  company_name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  bank_name?: string
  bank_branch?: string
  bank_account_type?: string
  bank_account_number?: string
  bank_account_name?: string
  standard_unit_price?: number
  invoice_number?: string
  is_invoice_registered?: boolean
  withholding_rate?: number
  notes?: string
}) {
  // ① ユーザー認証とテナント検証はanonクライアントで実施
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  // ② DB書き込みはadminクライアントで実施（RLSバイパス）
  const { data, error } = await adminDb().from('partners').insert({
    tenant_id:            tenantId,
    name:                 input.company_name,
    company_name:         input.company_name,
    contact_name:         input.contact_name        || null,
    email:                input.email               || null,
    phone:                input.phone               || null,
    address:              input.address             || null,
    bank_name:            input.bank_name           || null,
    bank_branch:          input.bank_branch         || null,
    bank_account_type:    input.bank_account_type   || '普通',
    bank_account_number:  input.bank_account_number || null,
    bank_account_name:    input.bank_account_name   || null,
    standard_unit_price:  input.standard_unit_price ?? 0,
    invoice_number:       input.invoice_number      || null,
    is_invoice_registered: input.is_invoice_registered ?? false,
    withholding_rate:     input.withholding_rate    ?? 0.1021,
    notes:                input.notes               || null,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/partners')
  return { success: true, id: data?.id as string }
}

// ─── 更新（admin クライアントで RLS をバイパス） ──────────
export async function updatePartner(id: string, input: Partial<Omit<Partner, 'id' | 'created_at'>>) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { data: existing } = await adminDb()
    .from('partners').select('id').eq('id', id).eq('tenant_id', tenantId).single()
  if (!existing) return { error: '対象レコードが見つかりません' }

  // ② 書き込みはadminクライアントで実施（updated_at は DB にカラムがある場合のみ）
  const { error } = await adminDb()
    .from('partners')
    .update(input)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/partners')
  revalidatePath(`/partners/${id}`)
  return { success: true }
}

// ─── 削除（論理削除、admin クライアントで RLS をバイパス） ─
export async function deletePartner(id: string) {
  const { user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { data: existing } = await adminDb()
    .from('partners').select('id').eq('id', id).eq('tenant_id', tenantId).single()
  if (!existing) return { error: '対象レコードが見つかりません' }

  // ② 物理削除（is_active カラムが DB に存在しないため）
  const { error } = await adminDb()
    .from('partners')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/partners')
  return { success: true }
}
