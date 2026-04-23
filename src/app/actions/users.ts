'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

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

  // 自分の role も返す
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

// ─── ユーザー削除（usersテーブルのレコード削除） ──────────
// Supabase Auth のユーザー本体は service_role が必要なため
// ここでは usersテーブルのみ削除。Auth側は Supabase ダッシュボードで対応。
export async function deleteUserRecord(targetUserId: string): Promise<{ success?: true; error?: string }> {
  const { db, user: me, tenantId, role } = await getCtx()

  if (!me || !tenantId) return { error: '未認証です' }
  if (role !== 'admin')   return { error: '管理者権限が必要です' }
  if (targetUserId === me.id) return { error: '自分自身は削除できません' }

  // 対象が同テナントに属するか確認してから削除
  const { error } = await db
    .from('users')
    .delete()
    .eq('id', targetUserId)
    .eq('tenant_id', tenantId)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return { success: true }
}

// ─── メンバー招待 ────────────────────────────────────────
export async function inviteUser(
  email: string,
  displayName: string,
  role: string,
): Promise<{ success?: true; error?: string }> {
  const { db, user: me, tenantId, role: myRole } = await getCtx()

  if (!me || !tenantId) return { error: '未認証です' }
  if (myRole !== 'admin') return { error: '管理者権限が必要です' }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { error: '正しいメールアドレスを入力してください' }
  }

  const name = displayName.trim() || trimmedEmail.split('@')[0]
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').trim()

  let adminClient: ReturnType<typeof createAdminClient>
  try {
    adminClient = createAdminClient()
  } catch {
    return { error: 'サービスロールキーが設定されていません（環境変数 SUPABASE_SERVICE_ROLE_KEY を確認してください）' }
  }

  // 同テナント内に既存ユーザーがいれば削除してから再招待
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', trimmedEmail)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing?.id) {
    const { error: delAuthErr } = await adminClient.auth.admin.deleteUser(existing.id)
    if (delAuthErr) return { error: `既存ユーザーの削除に失敗しました: ${delAuthErr.message}` }
    // CASCADE がない場合の保険として users テーブルも明示削除
    await db.from('users').delete().eq('id', existing.id)
  }

  // Auth ユーザーを作成して招待メールを送信
  const { data, error: authError } = await adminClient.auth.admin.inviteUserByEmail(
    trimmedEmail,
    {
      data: { display_name: name, tenant_id: tenantId, role },
      redirectTo: `${appUrl}/auth/callback`,
    },
  )
  if (authError) return { error: authError.message }

  // users テーブルに招待済みレコードを挿入（is_active: false）
  const { error: dbError } = await db
    .from('users')
    .upsert(
      {
        id:           data.user.id,
        email:        trimmedEmail,
        display_name: name,
        tenant_id:    tenantId,
        role,
        is_active:    false,
      },
      { onConflict: 'id' },
    )
  if (dbError) return { error: dbError.message }

  revalidatePath('/users')
  return { success: true }
}
