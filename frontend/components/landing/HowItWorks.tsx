'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { staggerContainer, staggerItem } from '@/components/landing/Reveal'
import { SectionHeading } from '@/components/landing/SectionHeading'

/**
 * HowItWorks — four-step flow on a connected rail.
 *
 * Previously four hand-duplicated blocks of near-identical markup with
 * hard-coded English. Now data-driven and fully translated.
 */

const STEPS = [
  { key: 'paste', icon: 'content_paste' },
  { key: 'analyze', icon: 'search_insights' },
  { key: 'configure', icon: 'tune' },
  { key: 'download', icon: 'download' },
] as const

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks')

  return (
    <section id="how-it-works" className="relative scroll-mt-24 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="grid-lines absolute inset-0 opacity-60" />
        <div className="aurora-blob aurora-blob--ember start-[-10%] top-[25%] h-[380px] w-[380px] opacity-40" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('heading')}
          titleAccent={t('headingAccent')}
          description={t('subheading')}
        />

        <div className="relative mt-16">
          {/* Connecting rail — desktop only */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/12 to-transparent lg:block"
          />

          <motion.ol
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
          >
            {STEPS.map((step, index) => (
              <motion.li
                key={step.key}
                variants={staggerItem}
                className="group relative flex flex-col items-center text-center"
              >
                {/* Node */}
                <div className="relative z-10 mb-6">
                  <span className="surface-solid flex h-14 w-14 items-center justify-center rounded-2xl text-ink-2 ring-1 ring-hairline transition-all duration-300 group-hover:text-[#ff7a7a] group-hover:ring-[#ea2a33]/40">
                    <MaterialIcon name={step.icon} size={22} />
                  </span>
                  <span className="absolute -end-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#ea2a33] font-mono text-[10px] font-bold text-white shadow-lg shadow-[#ea2a33]/40">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-base font-bold text-ink">{t(`steps.${step.key}.title`)}</h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-3">
                  {t(`steps.${step.key}.description`)}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </div>
    </section>
  )
}
