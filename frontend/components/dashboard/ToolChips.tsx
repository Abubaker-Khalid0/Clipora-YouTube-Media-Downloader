'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * ToolChips — the capability row shown under the URL bar on an empty dashboard.
 *
 * Previously each chip carried its own saturated gradient tile (red, violet,
 * amber, emerald, sky, fuchsia). Six competing colours pulled attention away
 * from the input, which is the only thing a first-time visitor needs to act on.
 * The icons are monochrome now and pick up the brand colour only on hover.
 */

const TOOLS = [
  { key: 'modeVideo', icon: 'play_arrow' },
  { key: 'modeAudio', icon: 'music_note' },
  { key: 'trimSegment', icon: 'content_cut' },
  { key: 'modeThumbnail', icon: 'image' },
  { key: 'modeTranscript', icon: 'description' },
  { key: 'featureSubtitle', icon: 'closed_caption' },
] as const

const EASE = [0.22, 1, 0.36, 1] as const

export function ToolChips() {
  const t = useTranslations('dashboard')

  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {TOOLS.map((tool, i) => (
        <motion.li
          key={tool.key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.3, ease: EASE }}
          className="group inline-flex cursor-default items-center gap-1.5 rounded-full border border-hairline bg-veil px-3 py-1.5 transition-colors duration-200 hover:border-hairline-strong hover:bg-veil-2"
        >
          <MaterialIcon
            name={tool.icon}
            size={14}
            className="text-ink-4 transition-colors duration-200 group-hover:text-brand"
          />
          <span className="text-[12px] font-semibold text-ink-3 transition-colors duration-200 group-hover:text-ink-2">
            {t(tool.key)}
          </span>
        </motion.li>
      ))}
    </ul>
  )
}
