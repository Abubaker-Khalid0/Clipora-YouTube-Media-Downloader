'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { Reveal } from '@/components/landing/Reveal'

/**
 * FinalCta â€” closing conversion block with a brand-lit panel.
 */
export function FinalCta({ locale }: { locale: string }) {
  const t = useTranslations('landing.finalCta')

  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="surface noise-overlay relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* Light sources */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
              <div className="aurora-blob aurora-blob--brand start-1/2 top-[-40%] h-[420px] w-[420px] -translate-x-1/2" />
              <div className="grid-lines absolute inset-0 opacity-50" />
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-veil-2 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
              <MaterialIcon name="bolt" size={12} className="text-[#ea2a33]" filled />
              {t('eyebrow')}
            </span>

            <h2 className="font-display mx-auto mt-6 max-w-2xl text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              <span className="text-gradient-light">{t('title')}</span>{' '}
              <span className="text-gradient-brand">{t('titleAccent')}</span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-3">
              {t('description')}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={`/${locale}/dashboard`}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#ea2a33] px-8 py-4 text-sm font-bold text-white transition-all duration-300 glow-brand-lg hover:bg-[#c91e26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33] sm:w-auto"
              >
                {t('cta')}
                <MaterialIcon
                  name="arrow_forward"
                  size={17}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                />
              </Link>
              <span className="text-[11px] text-ink-4">{t('note')}</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
