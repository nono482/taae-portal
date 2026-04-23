import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email' | null

  // open-redirect 防止: next は必ず相対パス（/ 始まり）のみ許可
  const rawNext = searchParams.get('next') ?? ''
  const next    = rawNext.startsWith('/') ? rawNext : '/dashboard'

  if (token_hash && type) {
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

    if (!error) {
      // type=invite は next（=/update-password）を優先、それ以外は next か /dashboard
      const dest = type === 'invite' ? (next || '/update-password') : next
      return NextResponse.redirect(new URL(dest, origin))
    }
  }

  // トークン不正 or 期限切れ → ログインへ
  return NextResponse.redirect(new URL('/login?error=invite_invalid', origin))
}
