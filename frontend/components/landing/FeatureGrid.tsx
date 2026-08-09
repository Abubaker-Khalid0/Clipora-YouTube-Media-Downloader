'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Reveal, staggerContainer, staggerItem } from '@/components/landing/Reveal'
import { SectionHeading } from '@/components/landing/SectionHeading'

/**
 * FeatureGrid — bento layout describing what the tool actually does.
 *
 * Every entry maps to a capability that exists in the app today (download,
 * trim, audio extraction, thumbnails, transcripts, burned subtitles), so the
 * page explains the product instead of making generic marketing claims.
 */

interface Feature {
  key: string
  icon: string
  /** Grid span on large screens — drives the bento rhythm. */
  span: string
  accent?: boolean
}

const FEATURES: Feature[] = [
  { key: 'download', icon: 'download', span: 'lg:col-span-3', accent: true },
  { key: 'trim', icon: 'content_cut', span: 'lg:col-span-3' },
  { key: 'audio', icon: 'music_note', span: 'lg:col-span-2' },
  { key: 'transcript', icon: 'description', span: 'lg:col-span-2' },
  { key: 'subtitles', icon: 'closed_caption', span: 'lg:col-span-2' },
]

export function FeatureGrid() {
  const t = useTranslations('landing.features')

  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob aurora-blob--brand end-[-15%] top-[10%] h-[420px] w-[420px] opacity-50" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('heading')}
          titleAccent={t('headingAccent')}
          description={t('subheading')}
        />

        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6"
        >
          {FEATURES.map((feature) => (
            <motion.li
              key={feature.key}
              variants={staggerItem}
              className={`surface surface-hover edge-light group relative overflow-hidden rounded-2xl p-6 ${feature.span}`}
            >
              {feature.accent && (
                <div
                  aria-hidden="true"
                  className="absolute -end-16 -top-16 h-40 w-40 rounded-full bg-[#ea2a33]/20 blur-3xl transition-opacity duration-500 group-hover:opacity-160"
                />
              )}

              <div className="relative">
                <span
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105 ${
                    feature.accent
                      ? 'bg-[#ea2a33]/15 text-[#ff7a7a] ring-[#ea2a33]/25'
                      : 'bg-veil-2 text-ink-2 ring-hairline'
                  }`}
                >
                  <MaterialIcon name={feature.icon} size={21} />
                </span>

                <h3 className="mt-5 text-base font-bold text-ink">
                  {t(`items.${feature.key}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">
                  {t(`items.${feature.key}.description`)}
                </p>

                <span className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-veil-2 px-2 py-1 font-mono text-[10px] text-ink-3">
                  {t(`items.${feature.key}.tag`)}
                </span>
              </div>
            </motion.li>
          ))}

          {/* Privacy callout closes the bento grid */}
          <Reveal as="li" className="lg:col-span-6" delay={0.1}>
            <div className="surface relative flex flex-col items-start gap-5 overflow-hidden rounded-2xl p-6 sm:flex-row sm:items-center sm:p-8">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(120,80,255,0.14),transparent_60%)]"
              />
              <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-400/25">
                <MaterialIcon name="shield_lock" size={22} />
              </span>
              <div className="relative flex-1">
                <h3 className="text-base font-bold text-ink">{t('items.privacy.title')}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
                  {t('items.privacy.description')}
                </p>
              </div>
              <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-400/25">
                <MaterialIcon name="timer" size={13} />
                {t('items.privacy.tag')}
              </span>
            </div>
          </Reveal>
        </motion.ul>
      </div>
    </section>
  )
}
