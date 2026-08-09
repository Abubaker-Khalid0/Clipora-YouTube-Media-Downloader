'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { AppShowcase } from '@/components/landing/AppShowcase'

/**
 * HeroSection â€” dark canvas, brand-red aurora, headline, dual CTA, live product mock.
 *
 * Replaces the previous version, which centred a glass card over a blurred
 * stock photo loaded from a third-party Google CDN and hard-coded its English
 * copy. Everything here is translated and drawn locally.
 */

const EASE = [0.22, 1, 0.36, 1] as const

const TRUST_ITEMS = ['noSignup', 'noWatermark', 'openSource'] as const

export function HeroSection({ locale }: { locale: string }) {
  const t = useTranslations('landing.hero')
  const reduceMotion = useReducedMotion()

  const rise = (delay: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.75, delay, ease: EASE },
  })

  return (
    <section className="relative overflow-hidden pb-20 pt-14 sm:pb-28 sm:pt-20">
      {/* â”€â”€ Background layers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="grid-lines absolute inset-0" />
        <div className="aurora-blob aurora-blob--brand start-[-10%] top-[-18%] h-[520px] w-[520px]" />
        <div className="aurora-blob aurora-blob--ember end-[-12%] top-[6%] h-[440px] w-[440px]" />
        <div className="aurora-blob aurora-blob--violet start-[35%] top-[45%] h-[560px] w-[560px]" />
        {/* Fade into the next section */}
        <div className="fade-to-canvas absolute inset-x-0 bottom-0 h-40" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* â”€â”€ Announcement badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.div {...rise(0)} className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-veil-2 px-3.5 py-1.5 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#ea2a33] opacity-75 pulse-ring" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ea2a33]" />
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-ink-2">
              {t('badge')}
            </span>
          </span>
        </motion.div>

        {/* â”€â”€ Headline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.h1
          {...rise(0.08)}
          className="font-display mx-auto mt-7 max-w-4xl text-center text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[4.5rem]"
        >
          <span className="text-gradient-light">{t('titleLead')}</span>
          <br />
          <span className="text-gradient-brand">{t('titleAccent')}</span>
        </motion.h1>

        <motion.p
          {...rise(0.16)}
          className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-ink-3 sm:text-lg"
        >
          {t('subtitle')}
        </motion.p>

        {/* â”€â”€ CTAs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.div
          {...rise(0.24)}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href={`/${locale}/dashboard`}
            className="group inline-flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[#ea2a33] px-8 py-3.5 text-sm font-bold text-white transition-all duration-300 glow-brand hover:bg-[#c91e26] hover:shadow-[0_16px_50px_-12px_rgba(234,42,51,0.8)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33] sm:w-auto"
          >
            {t('ctaPrimary')}
            <MaterialIcon
              name="arrow_forward"
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
            />
          </Link>

          <a
            href="#how-it-works"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline bg-veil px-7 py-3.5 text-sm font-semibold text-ink-2 backdrop-blur transition-colors hover:border-hairline-strong hover:text-ink sm:w-auto"
          >
            <MaterialIcon name="play_circle" size={17} />
            {t('ctaSecondary')}
          </a>
        </motion.div>

        {/* â”€â”€ Trust row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.ul
          {...rise(0.32)}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5"
        >
          {TRUST_ITEMS.map((key) => (
            <li key={key} className="inline-flex items-center gap-1.5 text-[11px] text-ink-4">
              <MaterialIcon name="check_circle" size={13} className="text-emerald-400/70" filled />
              {t(`trust.${key}`)}
            </li>
          ))}
        </motion.ul>

        {/* â”€â”€ Product mock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: EASE }}
          className="mt-16 sm:mt-20"
        >
          <AppShowcase />
        </motion.div>
      </div>
    </section>
  )
}
