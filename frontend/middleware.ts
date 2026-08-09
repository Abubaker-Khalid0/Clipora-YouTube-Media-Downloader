import { type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './lib/routing'

/**
 * Simplified middleware — only handles locale routing.
 * No auth checks during development.
 */

const intlMiddleware = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  return intlMiddleware(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
