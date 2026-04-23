'use server'

import { createClient } from '@/lib/supabase/server'

export async function updatePassword(
  password: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  // 招待承認完了 → is_active を true に更新
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await (supabase as any)
      .from('users')
      .update({ is_active: true })
      .eq('id', user.id)
  }

  return { success: true }
}
