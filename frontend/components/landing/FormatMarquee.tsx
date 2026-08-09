'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * FormatMarquee — ticker of the outputs the app can actually produce.
 *
 * The previous version put `bg-veil` pills on a `bg-veil` section: identical
 * fills, so the chips dissolved into the band and the whole strip read as a grey
 * smear on a light canvas. Chips are now opaque panels with a shadow, which
 * separates them from the recessed background in either theme.
 *
 * Pure CSS animation (no JS loop); the track is duplicated so the -50%
 * translate wraps seamlessly, and it pauses on hover or keyboard focus.
 */

const CAPABILITIES = [
  { icon: 'movie', label: 'MP4' },
  { icon: 'high_quality', label: '4K · 2160p' },
  { icon: 'hd', label: '1080p · 60fps' },
  { icon: 'music_note', label: 'MP3' },
  { icon: 'graphic_eq', label: 'M4A' },
  { icon: 'content_cut', label: 'Trim' },
  { icon: 'image', label: 'Thumbnails' },
  { icon: 'description', label: 'Transcript' },
  { icon: 'subtitles', label: 'SRT · VTT' },
  { icon: 'closed_caption', label: 'Burned Subtitles' },
] as const

export function FormatMarquee() {
  const t = useTranslations('landing.marquee')

  return (
    <section className="relative border-y border-hairline bg-canvas-soft py-10">
      {/* Heading with hairline rules — reads as a deliberate divider rather than
          a faint line of text floating above the strip. */}
      <div className="mx-auto mb-7 flex max-w-md items-center gap-4 px-6">
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--hairline)]" />
        <p className="eyebrow whitespace-nowrap text-ink-3">{t('heading')}</p>
        <span aria-hidden="true" className="h-px flex-1 bg-[var(--hairline)]" />
      </div>

      <div className="marquee-mask overflow-hidden">
        {/* aria-hidden: the duplicated track would be read out twice. The same
            capabilities are listed accessibly in the features section. */}
        <div className="marquee-track gap-3" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-3 pe-3">
              {CAPABILITIES.map((item) => (
                <span
                  key={`${copy}-${item.label}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-panel px-4 py-2.5 text-[13px] font-semibold text-ink-2 shadow-sm shadow-[var(--shadow-tint)]"
                >
                  <MaterialIcon name={item.icon} size={15} className="text-[#ea2a33]" />
                  {/* dir="ltr": every label is a latin format name, and the
                      middle dot in "4K · 2160p" flips position under RTL. */}
                  <span dir="ltr">{item.label}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
