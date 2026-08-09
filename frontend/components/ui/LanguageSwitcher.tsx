'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

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
        inline-flex h-9 items-center gap-1.5 rounded-full px-2.5
        text-xs font-bold tracking-wide transition-colors duration-200
        text-ink-3 hover:bg-veil-2 hover:text-ink
        disabled:cursor-not-allowed disabled:opacity-40
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]
        ${isPending ? 'animate-pulse' : ''}
      `}
    >
      <MaterialIcon name="language" size={14} className={`transition-transform duration-300 ${isPending ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </button>
  )
}
