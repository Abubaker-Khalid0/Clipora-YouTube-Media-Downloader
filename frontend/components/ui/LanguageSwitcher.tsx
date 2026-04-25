'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { Globe } from 'lucide-react'

/**
 * LanguageSwitcher — switches between /en/ and /ar/ while preserving
 * the current path segment after the locale prefix (FR-017).
 *
 * Named export required per Constitution Principle IX.
 */
export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const otherLocale = locale === 'en' ? 'ar' : 'en'
  const label = locale === 'en' ? 'AR' : 'EN'
  const fullLabel = locale === 'en' ? 'العربية' : 'English'

  function handleSwitch() {
    // Replace the current locale prefix with the other locale
    // e.g. /en/dashboard → /ar/dashboard
    const segments = pathname.split('/')
    segments[1] = otherLocale
    const newPath = segments.join('/')

    startTransition(() => {
      router.push(newPath)
    })
  }

  return (
    <button
      onClick={handleSwitch}
      disabled={isPending}
      aria-label={`Switch to ${fullLabel}`}
      title={`Switch to ${fullLabel}`}
      className={`
        inline-flex items-center gap-1.5 rounded-xl px-3 py-2
        text-xs font-bold tracking-wide transition-all duration-200
        text-slate-500 hover:text-slate-800
        bg-slate-50 hover:bg-slate-100
        border border-slate-200/80 hover:border-slate-300
        disabled:opacity-40 disabled:cursor-not-allowed
        ${isPending ? 'animate-pulse' : ''}
      `}
    >
      <Globe className={`w-3.5 h-3.5 transition-transform duration-300 ${isPending ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </button>
  )
}
