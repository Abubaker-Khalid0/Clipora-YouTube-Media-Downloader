'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'

/**
 * EmptyState — heading block above the URL bar.
 *
 * The tool chips moved out to ToolChips and now render *below* the input, so
 * nothing sits between the headline and the field the visitor has to fill in.
 */

const EASE = [0.22, 1, 0.36, 1] as const

export function EmptyState() {
  const t = useTranslations('dashboard')

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="flex flex-col items-center pb-7 text-center"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-veil px-3 py-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-[#ea2a33] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ea2a33]" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-4">
          {t('emptyBadge')}
        </span>
      </span>

      <h1 className="font-display mt-6 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-[2.6rem] sm:leading-[1.12]">
        <span className="text-gradient-light">{t('emptyHeading')}</span>
      </h1>

      <p className="mt-4 max-w-lg text-[15px] font-medium leading-relaxed text-ink-3">
        {t('emptySub')}
      </p>
    </motion.div>
  )
}
