import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log(`[middleware] running for: "${pathname}"`)

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

  console.log(`[middleware] session OK → pass through`)
  return response
}

// ─── matcher: 保護が必要なルートだけを列挙 ───────────────
// /login, /invite, /update-password, /auth/callback は
// ここに含めないことで middleware が一切触れない。
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/banking/:path*',
    '/contractors/:path*',
    '/expenses/:path*',
    '/export/:path*',
    '/notifications/:path*',
    '/outsourcing/:path*',
    '/payroll/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/users/:path*',
  ],
}
