import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BASE = 'https://taae-portal.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email' | null
  console.log('[callback] code:', code ? '✓' : 'none')
  console.log('[callback] token_hash:', token_hash ? '✓' : 'none')
  console.log('[callback] type:', type ?? 'none')

  // Collect cookies that Supabase wants to set, then apply them to the redirect response
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(c => pendingCookies.push(c as typeof pendingCookies[0]))
        },
      },
    },
  )

  function makeRedirect(dest: string) {
    const res = NextResponse.redirect(`${BASE}${dest}`)
    pendingCookies.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
    )
    return res
  }

  // ── PKCE フロー（code）──────────────────────────────────
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[callback] exchangeCodeForSession 失敗:', error.message)
      return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
    }
    console.log('[callback] PKCE 成功 → /update-password')
    return makeRedirect('/update-password')
  }

  // ── OTP / token_hash フロー ─────────────────────────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      console.error('[callback] verifyOtp 失敗:', error.message)
      return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
    }
    console.log('[callback] OTP 成功 → /update-password')
    return makeRedirect('/update-password')
  }

  // ── どちらも来なかった ──────────────────────────────────
  console.error('[callback] code も token_hash も未着')
  return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
}
