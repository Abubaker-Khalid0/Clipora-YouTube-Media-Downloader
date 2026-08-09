'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

/**
 * Navbar â€” scroll-aware landing header.
 *
 * Transparent over the hero, then condenses to a blurred bar once the visitor
 * scrolls. Hosts the LanguageSwitcher inline; it used to float over this bar
 * from the root layout and collided with the CTA.
 */

const NAV_LINKS = [
  { key: 'features', href: '#features' },
  { key: 'howItWorks', href: '#how-it-works' },
  { key: 'faq', href: '#faq' },
] as const

export function Navbar({ locale }: { locale: string }) {
  const t = useTranslations('landing.navbar')
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'border-b border-hairline bg-canvas/80 backdrop-blur-xl'
          : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8" aria-label={t('ariaLabel')}>
        <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-16' : 'h-20'}`}>
          {/* Brand */}
          <Link href={`/${locale}`} className="flex items-center gap-2.5">
            <Image
              src="/static/images/logo.png"
              alt=""
              width={30}
              height={30}
              className="h-7 w-7 object-contain"
              priority
            />
            <span className="font-display text-lg font-extrabold tracking-tight text-ink">
              Clipora
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  className="rounded-full px-3.5 py-2 text-[13px] font-medium text-ink-3 transition-colors hover:bg-veil-2 hover:text-ink"
                >
                  {t(link.key)}
                </a>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />

            <Link
              href={`/${locale}/dashboard`}
              className="hidden h-9 items-center justify-center rounded-full bg-ink px-4 text-[13px] font-bold text-canvas transition-opacity hover:opacity-85 sm:inline-flex"
            >
              {t('start')}
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={t('toggleMenu')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-2 transition-colors hover:text-ink md:hidden"
            >
              <MaterialIcon name={menuOpen ? 'close' : 'menu'} size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <motion.div
        initial={false}
        animate={{ height: menuOpen ? 'auto' : 0, opacity: menuOpen ? 1 : 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden border-t border-hairline bg-canvas/95 backdrop-blur-xl md:hidden"
      >
        <ul className="space-y-1 px-4 py-4">
          {NAV_LINKS.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-veil-2 hover:text-ink"
              >
                {t(link.key)}
              </a>
            </li>
          ))}
          <li className="pt-2">
            <Link
              href={`/${locale}/dashboard`}
              className="flex h-11 items-center justify-center rounded-full bg-[#ea2a33] text-sm font-bold text-white"
            >
              {t('start')}
            </Link>
          </li>
        </ul>
      </motion.div>
    </header>
  )
}
