import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

const isConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_URL.includes('dummy') &&
  SUPABASE_KEY.startsWith('eyJ') &&
  SUPABASE_KEY.length > 100 &&
  !SUPABASE_KEY.includes('placeholder') &&
  !SUPABASE_KEY.includes('dummy')

const effectiveUrl = isConfigured ? SUPABASE_URL : 'https://dummy.supabase.co'
const effectiveKey = isConfigured
  ? SUPABASE_KEY
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMH0.dummy_key_for_demo_mode_only'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    effectiveUrl,
    effectiveKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component からの呼び出しでは書き込みは無視
          }
        },
      },
    }
  )
}
