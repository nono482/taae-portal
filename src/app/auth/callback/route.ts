import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as 'invite' | 'recovery' | 'signup' | 'email' | null

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
      const dest = type === 'invite' ? '/update-password' : '/dashboard'
      return NextResponse.redirect(new URL(dest, origin))
    }
  }

  // トークン不正 or 期限切れ → ログインへ
  return NextResponse.redirect(new URL('/login?error=invite_invalid', origin))
}
