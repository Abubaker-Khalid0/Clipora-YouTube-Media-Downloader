'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Download, CheckCircle2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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

export function ProcessingButton({
  stage,
  percent = 0,
  onClick,
  disabled = false,
}: ProcessingButtonProps) {
  const t = useTranslations('dashboard')

  const getLabel = (): string => {
    switch (stage) {
      case 'idle':
        return t('startProcessing')
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

  const getIcon = () => {
    if (isProcessing) return <Loader2 className="w-5 h-5 animate-spin" />
    if (stage === 'ready') return <Download className="w-5 h-5" />
    if (stage === 'downloaded') return <CheckCircle2 className="w-5 h-5" />
    return <Sparkles className="w-5 h-5" />
  }

  const isProcessing =
    stage === 'initializing' ||
    stage === 'downloading' ||
    stage === 'merging' ||
    stage === 'trimming'

  const isDownloaded = stage === 'downloaded'
  const isReady = stage === 'ready'

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled || isProcessing}
        className={`
          relative w-full text-white font-bold py-4 rounded-xl
          transition-all duration-300 ease-out
          flex items-center justify-center gap-2.5 overflow-hidden
          ${isDownloaded
            ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg shadow-green-500/25'
            : isReady
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]'
              : 'bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]'
          }
          ${disabled || isProcessing ? 'opacity-60 cursor-not-allowed !shadow-none' : ''}
        `}
      >
        {/* Progress bar background (during processing) */}
        {isProcessing && (
          <motion.div
            className="absolute inset-0 bg-white/10"
            initial={{ width: '0%' }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ originX: 0 }}
          />
        )}

        {/* Button content */}
        <span className="relative z-10 flex items-center gap-2.5">
          {getIcon()}
          <AnimatePresence mode="wait">
            <motion.span
              key={stage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              aria-live="polite"
              aria-atomic="true"
              className="text-sm"
            >
              {getLabel()}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>

      {/* Progress indicator below button */}
      {isProcessing && (
        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  )
}
