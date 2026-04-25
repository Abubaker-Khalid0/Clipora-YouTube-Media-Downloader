import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/routing'

/**
 * T011/T013/T014 – Unified middleware:
 *   1. next-intl  → locale routing / redirect / rewrite
 *   2. Supabase   → session refresh (getUser keeps JWT fresh)
 *   3. Auth guard → route protection rules
 *
 * Route classification (T013):
 *   Protected  : /dashboard, /profile  (and any sub-paths)
 *   Auth-only  : /auth                 (and any sub-paths)
 *   Public     : /                     (landing page, API routes, _next/*)
 *
 * Redirect rules (T014):
 *   Unauthenticated + protected route  → /[locale]/auth
 *   Authenticated   + auth-only route  → /[locale]/dashboard
 *   Everything else                    → pass through
 */

const intlMiddleware = createMiddleware(routing)

/** Routes that require an active session (locale prefix will be stripped before matching) */
const PROTECTED_ROUTES = ['/dashboard', '/profile'] as const

/** Routes only accessible to guests (non-authenticated users) */
const AUTH_ONLY_ROUTES = ['/auth'] as const

/** Regex that strips any supported locale prefix from a pathname */
const LOCALE_PREFIX_RE = new RegExp(
  `^/(${routing.locales.join('|')})`
)

function stripLocale(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_RE, '') || '/'
}

function isProtectedRoute(pathname: string): boolean {
  const path = stripLocale(pathname)
  return PROTECTED_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  )
}

function isAuthOnlyRoute(pathname: string): boolean {
  const path = stripLocale(pathname)
  return AUTH_ONLY_ROUTES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  )
}

export default async function middleware(request: NextRequest) {
  // ── Step 1: next-intl handles locale detection / redirect / rewrite ──
  const intlResponse = intlMiddleware(request)

  // If next-intl issued a redirect (e.g. missing locale prefix, unknown locale),
  // honour it immediately — do NOT run auth checks on top of an intl redirect.
  if (
    intlResponse &&
    intlResponse.status >= 300 &&
    intlResponse.status < 400
  ) {
    return intlResponse
  }

  // ── Step 2: Supabase session refresh (mutates cookies on the response) ──
  let response = intlResponse ?? NextResponse.next({ request })

  // Guard: if Supabase is not configured yet (placeholder .env.local values),
  // skip the auth check and pass through cleanly. This prevents crashes and
  // redirect loops during local development before credentials are filled in.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.startsWith('your-') ||
    !supabaseUrl.startsWith('http')
  ) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Mirror updated session cookies into both the request and response objects
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always use getUser() (not getSession()) for server-side auth.
  // getUser() validates the JWT with Supabase every time; getSession() only
  // reads from the cookie and can be spoofed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Resolve the locale segment present in the pathname
  const localeMatch = pathname.match(LOCALE_PREFIX_RE)
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale

  // ── Step 3: Route protection rules (T014) ──

  // Rule A: Unauthenticated user tries to access a protected route
  if (!user && isProtectedRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${locale}/auth`
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  // Rule B: Authenticated user tries to access the auth page (already signed in)
  if (user && isAuthOnlyRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${locale}/dashboard`
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     * – _next/static  (built assets)
     * – _next/image   (image optimisation)
     * – favicon.ico, sitemap.xml, robots.txt
     * – any file with a known static extension
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
