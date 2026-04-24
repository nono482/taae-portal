import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
const SUPABASE_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim()

const supabaseReady =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_URL.includes('.supabase.co') &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_URL.includes('dummy') &&
  SUPABASE_KEY.startsWith('eyJ') &&
  SUPABASE_KEY.length > 100 &&
  !SUPABASE_KEY.includes('placeholder') &&
  !SUPABASE_KEY.includes('dummy')

// 未ログインでもアクセスできる公開ルート
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/invite',
  '/update-password',
  '/auth',          // /auth/callback を含む
]

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isPublic = PUBLIC_PATHS.some(
    p => pathname === p || pathname.startsWith(p + '/'),
  )

  console.log(`[proxy] pathname="${pathname}" isPublic=${isPublic}`)

  // 公開ルートはそのまま通過
  if (isPublic) {
    return NextResponse.next()
  }

  // Supabase未設定時はそのまま通過
  if (!supabaseReady) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.log(`[proxy] NO USER → redirect /login`)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
