'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface NotificationRow {
  id: string
  category: string
  priority: string
  title: string
  body: string
  is_read: boolean
  action_label: string | null
  action_href: string | null
  created_at: string
}

export async function getNotifications(): Promise<NotificationRow[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await (supabase as any)
      .from('notifications')
      .select('id, category, priority, title, body, is_read, action_label, action_href, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return (data ?? []) as NotificationRow[]
  } catch {
    return []
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    revalidatePath('/notifications')
  } catch {
    // 通知テーブルが未作成の場合は無視
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await (supabase as any)
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    revalidatePath('/notifications')
  } catch {
    // 通知テーブルが未作成の場合は無視
  }
}
