import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** Supabase が正しく設定されているか（anon key は eyJ で始まる JWT 形式） */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_URL.includes('dummy') &&
  SUPABASE_KEY.startsWith('eyJ') &&        // JWT形式のanon keyのみ許可
  SUPABASE_KEY.length > 100 &&             // anon keyは通常200文字超
  !SUPABASE_KEY.includes('placeholder') &&
  !SUPABASE_KEY.includes('dummy')

export function createClient() {
  if (!isSupabaseConfigured) {
    // 未設定時はダミークライアント（呼び出しはすべてエラーになるが、
    // dashboard 側の try/catch でフォールバックデモデータを表示)
    return createBrowserClient<Database>(
      'https://dummy.supabase.co',
      'dummy_key_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
  }
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY)
}
