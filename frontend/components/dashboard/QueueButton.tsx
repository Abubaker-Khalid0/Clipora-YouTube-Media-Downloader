'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useQueue } from './QueueProvider'

/**
 * QueueButton — the navbar entry point for the download queue.
 *
 * This is what closes the feedback loop. Previously the add button lived in the
 * control rail while the queue rendered at the bottom of the page, so a click
 * produced no visible change anywhere near the pointer. The counter here sits in
 * a sticky header, so it is on screen whenever an item is added, and the badge
 * re-keys on the count to give the change a beat of motion.
 */
export function QueueButton() {
  const t = useTranslations('dashboard')
  const { queue, isProcessing, openQueue } = useQueue()
  const count = queue.length

  return (
    <button
      onClick={openQueue}
      aria-label={t('queueOpen')}
      title={t('queueTitle')}
      className="relative inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-ink-3 transition-colors hover:bg-veil-2 hover:text-ink sm:px-3"
    >
      <MaterialIcon
        name={isProcessing ? 'progress_activity' : 'playlist_play'}
        size={18}
        className={isProcessing ? 'animate-spin text-brand' : ''}
      />
      <span className="hidden sm:inline">{t('queueNav')}</span>

      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 22 }}
          className="absolute -top-0.5 end-0 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ea2a33] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--ink-bg)]"
        >
          {count}
        </motion.span>
      )}
    </button>
  )
}
