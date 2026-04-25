/**
 * Locale-aware navigation primitives for Clipora.
 *
 * Re-exports Next.js navigation APIs (Link, useRouter, usePathname, redirect)
 * pre-configured with our routing setup so that every component that imports
 * from here automatically gets locale-prefixed URLs — no manual `/en/` or
 * `/ar/` strings needed anywhere in the codebase.
 *
 * Usage:
 *   import { Link, useRouter, redirect } from '@/lib/navigation'
 *   // Then use them exactly like the Next.js equivalents.
 */
import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, useRouter, usePathname, redirect } =
  createNavigation(routing)
