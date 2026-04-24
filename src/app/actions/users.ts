'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

const CALLBACK_URL = 'https://taae-portal.vercel.app/auth/callback'

async function getCtx() {
  const supabase = await createClient()
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { db, user: null, tenantId: null, role: null }
  const { data: u } = await db
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  return { db, user, tenantId: u?.tenant_id ?? null, role: (u?.role ?? null) as string | null }
}

// ─── ユーザー一覧取得 ─────────────────────────────────────
export async function getUsers() {
  const { db, user: me, tenantId } = await getCtx()
  if (!tenantId) return { data: [], myId: null, myRole: null }

  const { data } = await db
    .from('users')
    .select('id, email, display_name, role, avatar_url, is_active, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  const myRecord = (data ?? []).find((u: any) => u.id === me?.id)

  return {
    data:   (data ?? []) as UserRow[],
    myId:   me?.id ?? null,
    myRole: (myRecord?.role ?? null) as string | null,
  }
}

export interface UserRow {
  id:           string
  email:        string
  display_name: string
  role:         string
  avatar_url:   string | null
  is_active:    boolean
  created_at:   string
}

// ─── ユーザー削除 ─────────────────────────────────────────
export async function deleteUserRecord(targetUserId: string): Promise<{ success?: true; error?: string }> {
  const { db, user: me, tenantId, role } = await getCtx()

  if (!me || !tenantId) return { error: '未認証です' }
  if (role !== 'admin')   return { error: '管理者権限が必要です' }
  if (targetUserId === me.id) return { error: '自分自身は削除できません' }

  const { error } = await db
    .from('users')
    .delete()
    .eq('id', targetUserId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true }
}

// ─── 招待共通ヘルパー ─────────────────────────────────────
async function prepareInvite(email: string, displayName: string, role: string) {
  const { db, user: me, tenantId, role: myRole } = await getCtx()

  if (!me || !tenantId) return { error: '未認証です' as string }
  if (myRole !== 'admin') return { error: '管理者権限が必要です' as string }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { error: '正しいメールアドレスを入力してください' as string }
  }

  const name = displayName.trim() || trimmedEmail.split('@')[0]

  let adminClient: ReturnType<typeof createAdminClient>
  try {
    adminClient = createAdminClient()
  } catch {
    return { error: 'サービスロールキーが設定されていません（SUPABASE_SERVICE_ROLE_KEY を確認してください）' as string }
  }

  const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) console.error('[invite] listUsers:', listErr.message)

  const existing = (listData?.users ?? []).find(u => u.email?.toLowerCase() === trimmedEmail)
  if (existing) {
    console.log('[invite] 既存 Auth ユーザーを削除して再招待:', existing.id)
    const { error: delErr } = await adminClient.auth.admin.deleteUser(existing.id)
    if (delErr) return { error: `既存ユーザーの削除に失敗しました: ${delErr.message}` as string }
    await db.from('users').delete().eq('id', existing.id)
  }

  return { db, tenantId, trimmedEmail, name, adminClient, error: null }
}

// ─── メンバー招待（URL生成・ボット対策ハッシュ付き） ─────
export async function inviteUser(
  email: string,
  displayName: string,
  role: string,
): Promise<{ success?: true; inviteUrl?: string; error?: string }> {
  const prep = await prepareInvite(email, displayName, role)
  if (prep.error) return { error: prep.error }
  const { db, tenantId, trimmedEmail, name, adminClient } = prep as Required<typeof prep>

  const { data, error: authError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: trimmedEmail,
    options: {
      data: { display_name: name, tenant_id: tenantId, role },
      redirectTo: CALLBACK_URL,
    },
  })
  if (authError) return { error: authError.message }

  const { error: dbError } = await db.from('users').upsert(
    { id: data.user.id, email: trimmedEmail, display_name: name, tenant_id: tenantId, role, is_active: false },
    { onConflict: 'id' },
  )
  if (dbError) return { error: dbError.message }

  revalidatePath('/users')

  // action_link をハッシュフラグメントに隠してボットのトークン消費を防ぐ
  const encoded = Buffer.from(data.properties.action_link).toString('base64url')
  return { success: true, inviteUrl: `https://taae-portal.vercel.app/invite#${encoded}` }
}

// ─── メンバー招待（メール直送信） ────────────────────────
export async function inviteUserByEmail(
  email: string,
  displayName: string,
  role: string,
): Promise<{ success?: true; error?: string }> {
  const prep = await prepareInvite(email, displayName, role)
  if (prep.error) return { error: prep.error }
  const { db, tenantId, trimmedEmail, name, adminClient } = prep as Required<typeof prep>

  const { data, error: authError } = await adminClient.auth.admin.inviteUserByEmail(trimmedEmail, {
    data: { display_name: name, tenant_id: tenantId, role },
    redirectTo: CALLBACK_URL,
  })
  if (authError) return { error: authError.message }

  const { error: dbError } = await db.from('users').upsert(
    { id: data.user.id, email: trimmedEmail, display_name: name, tenant_id: tenantId, role, is_active: false },
    { onConflict: 'id' },
  )
  if (dbError) return { error: dbError.message }

  revalidatePath('/users')
  return { success: true }
}
