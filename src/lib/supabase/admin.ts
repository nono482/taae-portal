import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL      = (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '').trim()
const SERVICE_ROLE_KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

export function createAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が設定されていません')
  }
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
