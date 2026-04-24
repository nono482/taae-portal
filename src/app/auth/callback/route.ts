import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const BASE = 'https://taae-portal.vercel.app'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email' | null

  // 受け取ったパラメータを全件ログ（Vercel でどれが来ているか確認用）
  console.log('[callback] 受信パラメータ:', Object.fromEntries(searchParams.entries()))
  console.log('[callback] code:', code ? '✓' : 'none')
  console.log('[callback] token_hash:', token_hash ? '✓' : 'none')
  console.log('[callback] type:', type ?? 'none')

  // Supabase がセットしたい Cookie を収集し、実際に返すレスポンスに付与する
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

  // ── PKCE フロー（?code=xxx）─────────────────────────────
  if (code) {
    console.log('[callback] PKCE フロー: exchangeCodeForSession 開始')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('[callback] exchangeCodeForSession 失敗:', error.message)
      return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
    }
    console.log('[callback] PKCE 成功 → /update-password')
    return makeRedirect('/update-password')
  }

  // ── OTP フロー（?token_hash=xxx&type=invite）────────────
  if (token_hash && type) {
    console.log('[callback] OTP フロー: verifyOtp 開始 type=', type)
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (error) {
      console.error('[callback] verifyOtp 失敗 type=', type, 'error=', error.message)
      return NextResponse.redirect(`${BASE}/login?error=invite_invalid`)
    }
    console.log('[callback] OTP 成功 → /update-password')
    return makeRedirect('/update-password')
  }

  // ── パラメータなし → implicit flow（#access_token=xxx）の可能性 ──
  // ハッシュフラグメントはサーバーに届かない。
  // JS が動く HTML を返してブラウザ側でハッシュを読ませ、/update-password へ転送する。
  console.log('[callback] code も token_hash も未着 → implicit flow を試みる')
  return new Response(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>認証中...</title></head>
<body>
<script>
  var h = window.location.hash.slice(1)
  console.log('[callback-html] hash params:', h ? h.split('&').map(function(p){ return p.split('=')[0] }).join(',') : 'none')
  if (h && h.indexOf('access_token') !== -1) {
    window.location.replace('/update-password#' + h)
  } else {
    window.location.replace('/login?error=invite_invalid')
  }
</script>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
