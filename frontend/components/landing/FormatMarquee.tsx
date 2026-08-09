'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * FormatMarquee â€” infinite ticker of supported outputs.
 *
 * Communicates breadth at a glance. Pure CSS animation (no JS loop), and the
 * track is duplicated so the -50% translate wraps seamlessly.
 */

const CAPABILITIES = [
  { icon: 'movie', label: 'MP4' },
  { icon: 'high_quality', label: '4K Â· 2160p' },
  { icon: 'music_note', label: 'MP3' },
  { icon: 'graphic_eq', label: 'M4A' },
  { icon: 'content_cut', label: 'Trim' },
  { icon: 'image', label: 'Thumbnails' },
  { icon: 'subtitles', label: 'SRT Â· VTT' },
  { icon: 'description', label: 'Transcript' },
  { icon: 'closed_caption', label: 'Burned Subtitles' },
  { icon: 'hd', label: '1080p Â· 60fps' },
] as const

export function FormatMarquee() {
  const t = useTranslations('landing.marquee')

  return (
    <section className="relative border-y border-hairline bg-veil py-8">
      <p className="mb-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-ink-4">
        {t('heading')}
      </p>

      <div className="marquee-mask overflow-hidden">
        {/* aria-hidden: decorative repetition would spam screen readers.
            The capability list is stated accessibly in the features section. */}
        <div className="marquee-track gap-3" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-3 pe-3">
              {CAPABILITIES.map((item) => (
                <span
                  key={`${copy}-${item.label}`}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-veil px-4 py-2 text-xs font-semibold text-ink-3"
                >
                  <MaterialIcon name={item.icon} size={14} className="text-[#ea2a33]/80" />
                  {item.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
