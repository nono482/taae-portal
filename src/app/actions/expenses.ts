'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories'

// ─── ヘルパー ────────────────────────────────────────────
async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

// ─── 勘定科目一覧取得 ─────────────────────────────────────
export async function getExpenseCategories() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) {
    return { data: DEFAULT_CATEGORIES.map((c, i) => ({ id: String(i), name: c.name, account_code: c.account_code })) }
  }
  const { data } = await db
    .from('expense_categories')
    .select('id, name, account_code')
    .eq('tenant_id', tenantId)
    .order('name')
  if (data && data.length > 0) return { data }
  // DBにカテゴリがない場合はデフォルトを使用
  return { data: DEFAULT_CATEGORIES.map((c, i) => ({ id: String(i), name: c.name, account_code: c.account_code })) }
}

// ─── 経費一覧取得 ─────────────────────────────────────────
export async function getExpenses(filter?: { month?: string; status?: string }) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [], error: '未認証' }

  let query = db
    .from('expenses')
    .select('id, vendor_name, amount, tax_amount, expense_date, status, source, memo, ocr_confidence, category:expense_categories(name, account_code), submitter:users!submitted_by(display_name)')
    .eq('tenant_id', tenantId)
    .order('expense_date', { ascending: false })

  if (filter?.month) {
    const [y, m] = filter.month.split('-')
    const start = `${y}-${m}-01`
    const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10)
    query = query.gte('expense_date', start).lte('expense_date', end)
  }
  if (filter?.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: data ?? [], error: null }
}

// ─── 経費新規作成 ─────────────────────────────────────────
export async function createExpense(input: {
  vendor_name: string
  amount: number
  tax_amount: number
  expense_date: string
  category_id: string | null
  source: string
  memo?: string
  receipt_url?: string | null
}) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  // category_id が数字文字列（デフォルトカテゴリ）の場合は null にする
  const isDefaultCat = input.category_id !== null && /^\d+$/.test(input.category_id)
  const categoryId = isDefaultCat ? null : (input.category_id || null)

  // デフォルトカテゴリの場合、テナントにカテゴリを作成してから使用
  let resolvedCategoryId = categoryId
  if (isDefaultCat && input.category_id !== null) {
    const idx = parseInt(input.category_id)
    const cat = DEFAULT_CATEGORIES[idx]
    if (cat) {
      const { data: existing } = await db
        .from('expense_categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('name', cat.name)
        .single()
      if (existing) {
        resolvedCategoryId = existing.id
      } else {
        const { data: newCat } = await db
          .from('expense_categories')
          .insert({ tenant_id: tenantId, name: cat.name, account_code: cat.account_code, tax_type: cat.tax_type, is_system: true })
          .select('id')
          .single()
        resolvedCategoryId = newCat?.id ?? null
      }
    }
  }

  const { error } = await db.from('expenses').insert({
    tenant_id:    tenantId,
    submitted_by: user.id,
    vendor_name:  input.vendor_name,
    amount:       input.amount,
    tax_amount:   input.tax_amount,
    expense_date: input.expense_date,
    category_id:  resolvedCategoryId,
    source:       input.source || 'web',
    memo:         input.memo || null,
    receipt_url:  input.receipt_url ?? null,
    status:       'pending',
  })

  if (error) return { error: error.message }

  // 管理者へ通知を送信（失敗しても経費登録は成功扱い）
  try {
    const adminClient = createAdminClient()
    const [adminsRes, submitterRes] = await Promise.all([
      db.from('users').select('id').eq('tenant_id', tenantId).eq('role', 'admin'),
      db.from('users').select('display_name').eq('id', user.id).single(),
    ])
    const admins = (adminsRes.data ?? []) as Array<{ id: string }>
    const submitterName = (submitterRes.data as any)?.display_name ?? 'メンバー'

    if (admins.length > 0) {
      await (adminClient as any).from('notifications').insert(
        admins.map((a) => ({
          tenant_id:    tenantId,
          user_id:      a.id,
          category:     'expense',
          priority:     'medium',
          title:        `${submitterName}さんが経費申請しました`,
          body:         `${input.vendor_name} ¥${Number(input.amount).toLocaleString()}（${input.expense_date}）の申請が届きました。承認をお願いします。`,
          action_label: '確認する',
          action_href:  '/expenses',
        }))
      )
    }
  } catch (e) {
    console.error('[createExpense] 通知送信失敗:', e)
  }

  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  revalidatePath('/notifications')
  return { success: true }
}

// ─── カテゴリ 検索 or 新規作成 ───────────────────────────
export async function findOrCreateCategory(
  name: string,
): Promise<{ id: string | null }> {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { id: null }

  const trimmed = name.trim()
  if (!trimmed) return { id: null }

  const { data: existing } = await db
    .from('expense_categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', trimmed)
    .maybeSingle()

  if (existing) return { id: existing.id }

  const { data: newCat } = await db
    .from('expense_categories')
    .insert({
      tenant_id:    tenantId,
      name:         trimmed,
      account_code: '899',
      tax_type:     '10%',
      is_system:    false,
    })
    .select('id')
    .single()

  return { id: newCat?.id ?? null }
}

// ─── 承認 ────────────────────────────────────────────────
export async function approveExpense(expenseId: string) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await db
    .from('expenses')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { success: true }
}

// ─── 却下 ────────────────────────────────────────────────
export async function rejectExpense(expenseId: string) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await db
    .from('expenses')
    .update({ status: 'rejected' })
    .eq('id', expenseId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { success: true }
}

// ─── 一括承認 ────────────────────────────────────────────
export async function bulkApproveExpenses(expenseIds: string[]) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  const { error } = await db
    .from('expenses')
    .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
    .in('id', expenseIds)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }
  revalidatePath('/expenses')
  revalidatePath('/dashboard')
  return { success: true }
}
