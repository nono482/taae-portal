'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id, role').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null, role: u?.role }
}

// ─── テナント設定取得 ─────────────────────────────────────
export async function getTenantSettings() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: null }

  const { data } = await db
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  return { data }
}

// ─── テナント設定更新 ─────────────────────────────────────
export async function updateTenantSettings(input: {
  name?: string
  slug?: string
  invoice_number?: string
  fiscal_month?: number
}) {
  const { db, tenantId, role } = await getCtx()
  if (!tenantId) return { error: '未認証' }
  if (role !== 'admin') return { error: '管理者権限が必要です' }

  const { error } = await db
    .from('tenants')
    .update({
      ...(input.name && { name: input.name }),
      ...(input.invoice_number !== undefined && { invoice_number: input.invoice_number }),
      ...(input.fiscal_month !== undefined && { fiscal_month: input.fiscal_month }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  return { success: true }
}

// ─── 現在ユーザー情報取得 ─────────────────────────────────
export async function getCurrentUser() {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { data: null }

  const { data } = await db
    .from('users')
    .select('id, display_name, email, role, avatar_url')
    .eq('id', user.id)
    .single()

  return { data }
}

// ─── プロフィール更新 ─────────────────────────────────────
export async function updateProfile(input: { display_name: string }) {
  const { db, user } = await getCtx()
  if (!user) return { error: '未認証' }

  const trimmed = input.display_name.trim()
  if (!trimmed) return { error: '表示名を入力してください' }

  const { error } = await db
    .from('users')
    .update({ display_name: trimmed })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}
