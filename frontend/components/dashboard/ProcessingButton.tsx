'use client'

import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LiquidFill } from '@/components/ui/LiquidFill'

type ButtonStage =
  | 'idle'
  | 'initializing'
  | 'downloading'
  | 'merging'
  | 'trimming'
  | 'ready'
  | 'downloaded'

interface ProcessingButtonProps {
  stage: ButtonStage
  percent?: number
  onClick: () => void
  disabled?: boolean
}

/**
 * ProcessingButton — primary action for the selected tool.
 *
 * Progress is now the water level inside the button itself. The old version
 * stacked three separate indicators: a white overlay that grew from the left, a
 * spinning icon, and a second progress bar underneath — three things saying one
 * thing, in a button that also swapped between red, blue, and green gradients.
 *
 * `initializing` and `merging` have no percentage, so the level breathes rather
 * than sitting frozen at 0 or faking movement.
 */
export function ProcessingButton({
  stage,
  percent = 0,
  onClick,
  disabled = false,
}: ProcessingButtonProps) {
  const t = useTranslations('dashboard')

  const isProcessing =
    stage === 'initializing' ||
    stage === 'downloading' ||
    stage === 'merging' ||
    stage === 'trimming'

  const isReady = stage === 'ready'
  const isDownloaded = stage === 'downloaded'

  // Only `downloading` reports a real number; the rest are opaque server phases.
  const hasPercent = stage === 'downloading' || stage === 'trimming'

  const label = (): string => {
    switch (stage) {
      case 'initializing':
        return t('initializing')
      case 'downloading':
        return t('downloading', { percent })
      case 'merging':
        return t('merging')
      case 'trimming':
        return t('trimming')
      case 'ready':
        return t('downloadReady')
      case 'downloaded':
        return t('downloaded')
      default:
        return t('startProcessing')
    }
  }

  const icon = (): string => {
    if (isProcessing) return 'water_drop'
    if (isReady) return 'download'
    if (isDownloaded) return 'check_circle'
    return 'auto_awesome'
  }

  // One base colour per state instead of a gradient swap, so the water reads as
  // a lighter shade of the same liquid rather than a different material.
  const base = isDownloaded
    ? 'bg-emerald-600'
    : isReady
      ? 'bg-[#0f766e]'
      : isProcessing
        ? 'bg-[#8f1319]'
        : 'bg-[#ea2a33] hover:bg-[#c91e26] active:scale-[0.99]'

  return (
    <button
      onClick={onClick}
      disabled={disabled || isProcessing}
      aria-busy={isProcessing}
      className={`liquid-host flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 font-bold text-white transition-colors duration-300
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]
        disabled:cursor-not-allowed
        ${base}
        ${disabled && !isProcessing ? 'opacity-45' : ''}`}
    >
      {isProcessing && (
        <LiquidFill
          level={percent}
          indeterminate={!hasPercent}
          color="rgba(255, 255, 255, 0.26)"
        />
      )}

      <span className="relative z-10 flex items-center gap-2.5">
        <MaterialIcon
          name={icon()}
          size={19}
          filled={isProcessing || isDownloaded}
          className={isProcessing ? 'animate-pulse' : ''}
        />

        <AnimatePresence mode="wait">
          <motion.span
            key={label()}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            aria-live="polite"
            aria-atomic="true"
            className="text-sm tabular-nums"
          >
            {label()}
          </motion.span>
        </AnimatePresence>
      </span>

      {/* Screen readers get the number even when the label has no placeholder. */}
      {isProcessing && hasPercent && (
        <span className="sr-only" role="status">
          {percent}%
        </span>
      )}
    </button>
  )
}
