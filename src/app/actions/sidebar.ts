'use server'

import { createClient } from '@/lib/supabase/server'

export type SidebarData = {
  displayName: string
  role: string
  initial: string
  unreadNotifCount: number
  pendingExpenseCount: number
}

export async function getSidebarData(): Promise<SidebarData> {
  const fallback: SidebarData = {
    displayName: '',
    role: 'member',
    initial: '?',
    unreadNotifCount: 0,
    pendingExpenseCount: 0,
  }

  try {
    const supabase = await createClient()
    const db = supabase as any
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fallback

    const { data: u } = await db
      .from('users')
      .select('tenant_id, role, display_name')
      .eq('id', user.id)
      .single()

    if (!u) return fallback

    const tenantId   = u.tenant_id as string
    const role       = (u.role ?? 'member') as string
    const displayName = (u.display_name ?? '') as string
    const initial    = displayName.slice(0, 1) || '?'

    const isPrivileged = role === 'admin' || role === 'accountant'

    const [notifRes, expRes] = await Promise.all([
      db
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false),

      isPrivileged
        ? db
            .from('expenses')
            .select('id', { count: 'exact' })
            .eq('tenant_id', tenantId)
            .eq('status', 'pending')
        : Promise.resolve({ count: 0 }),
    ])

    return {
      displayName,
      role,
      initial,
      unreadNotifCount:    notifRes.count  ?? 0,
      pendingExpenseCount: expRes.count ?? 0,
    }
  } catch {
    return fallback
  }
}
