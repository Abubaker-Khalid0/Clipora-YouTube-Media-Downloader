'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Link } from '@/lib/navigation'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/**
 * DashboardNavbar — app header.
 *
 * Three things changed from the previous version:
 *  - The credits badge is gone. It read from a stub that always returns 999, so
 *    it displayed a number that means nothing and implied a billing system that
 *    does not exist.
 *  - `bg-slate-150` (the divider) is not a Tailwind colour, so the rule never
 *    applied and the divider was invisible.
 *  - Colours now resolve through theme tokens, so the header follows the
 *    light/dark switch instead of staying permanently white.
 */
export function DashboardNavbar() {
  const t = useTranslations('dashboard')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 h-16 w-full transition-colors duration-300 ${
        scrolled ? 'border-b border-hairline bg-canvas/85 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
        {/* Brand */}
        <Link href="/dashboard" className="group flex items-center gap-2.5">
          <Image
            src="/static/images/logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain transition-transform duration-300 group-hover:scale-105"
            priority
          />
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Clipora
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {/* Back to the marketing page — previously unreachable from the app. */}
          <Link
            href="/"
            className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink-3 transition-colors hover:bg-veil-2 hover:text-ink sm:inline-flex"
          >
            <MaterialIcon name="home" size={16} />
            {t('navHome')}
          </Link>

          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-veil-3 sm:block" />

          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
