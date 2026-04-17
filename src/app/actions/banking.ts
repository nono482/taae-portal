'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ParsedTransaction } from '@/lib/csvParser'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null }
  const { data: u } = await db.from('users').select('tenant_id').eq('id', user.id).single()
  return { db, user, tenantId: u?.tenant_id ?? null }
}

// ─── 銀行取引一覧取得 ─────────────────────────────────────
export async function getBankTransactions(months = 3) {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  const from = new Date()
  from.setMonth(from.getMonth() - months)
  const fromStr = from.toISOString().slice(0, 10)

  const { data } = await db
    .from('bank_transactions')
    .select('id, transaction_date, description, amount, direction, balance_after')
    .eq('tenant_id', tenantId)
    .gte('transaction_date', fromStr)
    .order('transaction_date', { ascending: false })

  return { data: data ?? [] }
}

// ─── 銀行口座残高取得 ─────────────────────────────────────
export async function getBankAccounts() {
  const { db, tenantId } = await getCtx()
  if (!tenantId) return { data: [] }

  const { data } = await db
    .from('bank_accounts')
    .select('id, bank_name, balance, last_synced_at')
    .eq('tenant_id', tenantId)
    .order('balance', { ascending: false })

  return { data: data ?? [] }
}

// ─── CSV インポートを DB に保存 ────────────────────────────
export async function saveBankTransactions(
  transactions: ParsedTransaction[],
  bankName: string,
  lastBalance?: number,
) {
  const { db, user, tenantId } = await getCtx()
  if (!user || !tenantId) return { error: '未認証' }

  // 銀行口座を upsert（bank_name でユニーク）
  let accountId: string
  const { data: existingAcct } = await db
    .from('bank_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('bank_name', bankName)
    .single()

  if (existingAcct) {
    accountId = existingAcct.id
    if (lastBalance !== undefined) {
      await db.from('bank_accounts')
        .update({ balance: lastBalance, last_synced_at: new Date().toISOString() })
        .eq('id', accountId)
    }
  } else {
    const { data: newAcct, error: acctErr } = await db
      .from('bank_accounts')
      .insert({
        tenant_id:      tenantId,
        bank_name:      bankName,
        branch_name:    null,
        account_number: '000000',
        account_type:   'checking',
        balance:        lastBalance ?? 0,
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (acctErr) return { error: acctErr.message }
    accountId = newAcct.id
  }

  // 取引を upsert（同じ日付・金額・方向は重複とみなしてスキップ）
  const rows = transactions.map(t => ({
    tenant_id:        tenantId,
    account_id:       accountId,
    transaction_date: t.date,
    description:      t.description,
    amount:           t.amount,
    direction:        t.direction,
    balance_after:    t.balance ?? null,
    source_csv:       bankName,
  }))

  // 既存の重複チェック（同日・同金額・同方向）
  const dates = [...new Set(rows.map(r => r.transaction_date))]
  const { data: existing } = await db
    .from('bank_transactions')
    .select('transaction_date, amount, direction')
    .eq('tenant_id', tenantId)
    .in('transaction_date', dates)

  const existingSet = new Set(
    (existing ?? []).map((r: any) => `${r.transaction_date}|${r.amount}|${r.direction}`)
  )
  const newRows = rows.filter(r =>
    !existingSet.has(`${r.transaction_date}|${r.amount}|${r.direction}`)
  )

  if (newRows.length === 0) return { success: true, imported: 0, skipped: rows.length }

  const { error } = await db.from('bank_transactions').insert(newRows)
  if (error) return { error: error.message }

  revalidatePath('/banking')
  revalidatePath('/dashboard')
  revalidatePath('/reports')
  return { success: true, imported: newRows.length, skipped: rows.length - newRows.length }
}
