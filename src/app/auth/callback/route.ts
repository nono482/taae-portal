import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email' | null

  // open-redirect 防止: next は必ず相対パス（/ 始まり）のみ許可
  const rawNext = searchParams.get('next') ?? ''
  const next    = rawNext.startsWith('/') ? rawNext : '/dashboard'

  // origin はリクエストURLから導出せず本番URLで固定
  const BASE = 'https://taae-portal.vercel.app'

  console.log('[callback] token_hash:', token_hash ? '✓' : 'MISSING')
  console.log('[callback] type:', type ?? 'MISSING')
  console.log('[callback] next:', next)

  if (!token_hash || !type) {
    console.error('[callback] token_hash または type が未着 → /login へ')
    return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    {
      cookies: {
        getAll()              { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.verifyOtp({ token_hash, type })

  if (error) {
    console.error('[callback] verifyOtp 失敗:', error.message)
    return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
  }

  // type=invite は next（=/update-password）へ、それ以外も next へ
  const dest = type === 'invite' ? (next || '/update-password') : next
  console.log('[callback] verifyOtp 成功 → リダイレクト先:', dest)
  return NextResponse.redirect(`${BASE}${dest}`)
}
