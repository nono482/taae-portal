import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 未ログインでもアクセスできる公開ルート
const PUBLIC_PATHS = [
  '/login',
  '/invite',
  '/update-password',
  '/auth/callback',
]

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isPublic = PUBLIC_PATHS.some(
    path => pathname === path || pathname.startsWith(path + '/'),
  )

  console.log(`[middleware] pathname="${pathname}" isPublic=${isPublic}`)

  if (isPublic) {
    console.log(`[middleware] PUBLIC → NextResponse.next()`)
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '').trim(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    console.log(`[middleware] NO SESSION → redirect /login`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  console.log(`[middleware] session OK → NextResponse.next()`)
  return response
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにミドルウェアを適用:
     * - _next/static  (静的ファイル)
     * - _next/image   (画像最適化)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
