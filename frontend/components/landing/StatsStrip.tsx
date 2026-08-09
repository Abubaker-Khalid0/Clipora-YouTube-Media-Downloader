'use client'

import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/landing/Reveal'

/**
 * StatsStrip â€” four verifiable capability numbers.
 *
 * Deliberately technical facts drawn from what the backend actually supports
 * (max resolution, output formats, free credits, temp-file retention) rather
 * than invented traction metrics like user or download counts.
 */

interface Stat {
  key: string
  value: number
  suffix?: string
  prefix?: string
}

const STATS: Stat[] = [
  { key: 'resolution', value: 2160, suffix: 'p' },
  { key: 'formats', value: 8, suffix: '+' },
  // Was a "10 free credits" claim. There is no auth or billing in the app, so
  // every operation is genuinely free â€” advertising a credit balance was false.
  { key: 'cost', value: 0, prefix: '$' },
  { key: 'retention', value: 30 },
]

export function StatsStrip() {
  const t = useTranslations('landing.stats')

  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <dl className="surface grid grid-cols-2 gap-y-8 rounded-2xl px-6 py-9 sm:px-10 lg:grid-cols-4">
            {STATS.map((stat, index) => (
              <div
                key={stat.key}
                className={`flex flex-col items-center text-center ${
                  index !== STATS.length - 1 ? 'lg:border-e lg:border-hairline' : ''
                }`}
              >
                <dd className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  <span className="text-gradient-brand">
                    {stat.prefix}
                    <Counter target={stat.value} />
                    {stat.suffix}
                  </span>
                </dd>
                <dt className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-4">
                  {t(`${stat.key}.label`)}
                </dt>
                <span className="mt-1 text-[11px] text-ink-4">{t(`${stat.key}.hint`)}</span>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

/** Counts from 0 to `target` once scrolled into view. */
function Counter({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduceMotion) {
      // Deferred to a frame callback so this is not a synchronous setState in an
      // effect body (react-hooks/set-state-in-effect).
      const id = requestAnimationFrame(() => setDisplay(target))
      return () => cancelAnimationFrame(id)
    }

    const duration = 1200
    const started = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const ratio = Math.min((now - started) / duration, 1)
      // easeOutCubic
      setDisplay(Math.round((1 - Math.pow(1 - ratio, 3)) * target))
      if (ratio < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, target, reduceMotion])

  return <span ref={ref}>{display.toLocaleString()}</span>
}
