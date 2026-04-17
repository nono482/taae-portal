import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const _RAW_URL    = (process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '').trim()
const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

// new URL() で正規化（不正文字・末尾スラッシュを除去）
let SUPABASE_URL = _RAW_URL
if (_RAW_URL) {
  try {
    SUPABASE_URL = new URL(_RAW_URL).toString().replace(/\/$/, '')
  } catch {
    SUPABASE_URL = ''
  }
}

/** Supabase が正しく設定されているか */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  SUPABASE_KEY.startsWith('eyJ') &&
  SUPABASE_KEY.length > 100

export function createClient() {
  if (!isSupabaseConfigured) {
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.placeholder_do_not_use',
    )
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
}
