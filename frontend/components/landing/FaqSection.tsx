'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Reveal } from '@/components/landing/Reveal'
import { SectionHeading } from '@/components/landing/SectionHeading'

/**
 * FaqSection — accordion answering the questions that actually block a first
 * download (cost, quality, privacy, members-only videos, playlists, formats).
 *
 * Hand-built on native <button> semantics rather than pulling in another
 * dependency: aria-expanded + aria-controls give assistive tech the state, and
 * only the panel height animates.
 */

const QUESTION_KEYS = ['cost', 'quality', 'privacy', 'restricted', 'playlists', 'audio'] as const

const EASE = [0.22, 1, 0.36, 1] as const

export function FaqSection() {
  const t = useTranslations('landing.faq')
  const [openKey, setOpenKey] = useState<string | null>(QUESTION_KEYS[0])

  return (
    <section id="faq" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('heading')}
          titleAccent={t('headingAccent')}
        />

        <div className="mt-12 space-y-3">
          {QUESTION_KEYS.map((key, index) => {
            const isOpen = openKey === key
            return (
              <Reveal key={key} delay={index * 0.05}>
                <div
                  className={`surface overflow-hidden rounded-xl transition-colors ${
                    isOpen ? 'border-hairline-strong' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : key)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${key}`}
                    id={`faq-trigger-${key}`}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start transition-colors hover:bg-veil"
                  >
                    <span className="text-[15px] font-semibold text-ink">
                      {t(`items.${key}.question`)}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        isOpen ? 'bg-[#ea2a33] text-white' : 'bg-veil-2 text-ink-3'
                      }`}
                    >
                      <MaterialIcon name="add" size={16} />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="panel"
                        id={`faq-panel-${key}`}
                        role="region"
                        aria-labelledby={`faq-trigger-${key}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-ink-3">
                          {t(`items.${key}.answer`)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
