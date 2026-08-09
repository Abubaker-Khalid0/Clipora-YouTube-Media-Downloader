'use client'

import { Reveal } from '@/components/landing/Reveal'

/**
 * SectionHeading — shared eyebrow + title + description block.
 *
 * Every landing section used to hand-roll its own heading markup with slightly
 * different sizes and weights. Centralising it keeps the vertical rhythm exact.
 */

interface SectionHeadingProps {
  eyebrow: string
  title: string
  /** Rendered in brand gradient right after the title. */
  titleAccent?: string
  description?: string
  align?: 'center' | 'start'
}

export function SectionHeading({
  eyebrow,
  title,
  titleAccent,
  description,
  align = 'center',
}: SectionHeadingProps) {
  const alignment = align === 'center' ? 'items-center text-center' : 'items-start text-start'

  return (
    <div className={`flex flex-col ${alignment}`}>
      <Reveal>
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-veil px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
          {eyebrow}
        </span>
      </Reveal>

      <Reveal delay={0.08}>
        <h2 className="font-display mt-5 max-w-3xl text-3xl font-extrabold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.9rem]">
          <span className="text-gradient-light">{title}</span>
          {titleAccent && (
            <>
              {' '}
              <span className="text-gradient-brand">{titleAccent}</span>
            </>
          )}
        </h2>
      </Reveal>

      {description && (
        <Reveal delay={0.14}>
          <p
            className={`mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-3 ${
              align === 'center' ? 'mx-auto' : ''
            }`}
          >
            {description}
          </p>
        </Reveal>
      )}
    </div>
  )
}
