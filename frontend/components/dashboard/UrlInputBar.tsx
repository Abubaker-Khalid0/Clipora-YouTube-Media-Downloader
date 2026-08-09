'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LiquidFill } from '@/components/ui/LiquidFill'
import { extractYouTubeId } from '@/lib/utils'

interface UrlInputBarProps {
  onAnalyze: (url: string) => Promise<void>
  isAnalyzing: boolean
  disabled?: boolean
}

/**
 * UrlInputBar — the single entry point of the app.
 *
 * Rebuilt from a bulky version that used a 2px border, py-5 padding, text-lg,
 * and a 4px focus ring, which together read as an oversized rectangle. It now
 * sits on a fixed 56px row with a hairline border and a restrained focus ring.
 *
 * Two behaviour fixes:
 *  - The error message was the hard-coded English string 'Invalid YouTube URL',
 *    so Arabic users saw English. It is translated now.
 *  - Validation ran on every keystroke, so the error flashed while you were
 *    still typing. It now waits for blur or submit.
 */
export function UrlInputBar({ onAnalyze, isAnalyzing, disabled = false }: UrlInputBarProps) {
  const t = useTranslations('dashboard')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const isValid = url.trim().length > 0 && extractYouTubeId(url) !== null
  const isBusy = isAnalyzing || disabled

  const handleChange = (value: string) => {
    setUrl(value)
    // Clear on edit; a message that reappears per character is noise.
    if (error) setError(null)
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (url.trim() && !extractYouTubeId(url)) setError(t('invalidUrl'))
  }

  const handleSubmit = async () => {
    if (!extractYouTubeId(url)) {
      setError(t('invalidUrl'))
      return
    }
    setError(null)
    await onAnalyze(url)
  }

  const handleClear = () => {
    setUrl('')
    setError(null)
  }

  const ringClass = error
    ? 'border-[#ea2a33] ring-2 ring-[var(--brand-tint-strong)]'
    : isFocused
      ? 'border-[#ea2a33] ring-2 ring-[var(--brand-tint)]'
      : 'border-hairline hover:border-hairline-strong'

  return (
    <div className="w-full">
      <div
        className={`relative flex h-14 items-center gap-2 rounded-xl border bg-panel ps-4 pe-2 shadow-sm shadow-[var(--shadow-tint)] transition-[border-color,box-shadow] duration-200 ${ringClass}`}
      >
        <MaterialIcon
          name={url.trim() ? 'link' : 'search'}
          size={19}
          className={`flex-shrink-0 transition-colors duration-200 ${
            isFocused || url.trim() ? 'text-brand' : 'text-ink-4'
          }`}
        />

        <input
          type="url"
          inputMode="url"
          dir="ltr"
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isValid && !isBusy) handleSubmit()
            if (e.key === 'Escape') handleClear()
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          placeholder={t('placeholder')}
          disabled={isBusy}
          aria-invalid={!!error}
          aria-label={t('placeholder')}
          // dir="ltr" with a logical text-start keeps the URL readable in Arabic
          // while the caret still begins on the correct side.
          className="h-full min-w-0 flex-1 bg-transparent text-start text-[15px] font-medium tracking-tight text-ink outline-none placeholder:text-ink-4 disabled:opacity-50"
        />

        {/* Clear — only while there is something to clear and nothing running. */}
        <AnimatePresence>
          {url.length > 0 && !isAnalyzing && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.15 }}
              onClick={handleClear}
              aria-label={t('clearUrl')}
              className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-4 transition-colors hover:bg-veil-2 hover:text-ink"
            >
              <MaterialIcon name="close" size={15} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Compact circular action. The previous pill carried a label and pushed
            the row wide; the field is the focus, so this is icon-only and the
            state is conveyed by the liquid instead of changing text. */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isBusy}
          aria-label={isAnalyzing ? t('analyzing') : t('analyze')}
          title={isAnalyzing ? t('analyzing') : t('analyze')}
          className={`liquid-host inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-all duration-200
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]
            disabled:cursor-not-allowed disabled:opacity-35
            ${isAnalyzing ? 'cursor-wait bg-[#8f1319]' : 'bg-[#ea2a33] hover:bg-[#c91e26] active:scale-95'}`}
        >
          {/* Analysis has no measurable percentage, so the level breathes. */}
          {isAnalyzing && <LiquidFill indeterminate color="rgba(255,255,255,0.32)" />}

          <MaterialIcon
            name={isAnalyzing ? 'more_horiz' : 'arrow_forward'}
            size={18}
            className={`relative z-10 ${isAnalyzing ? 'animate-pulse' : 'rtl:rotate-180'}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            role="alert"
            className="ms-1 mt-2 flex items-center gap-1.5 text-[13px] font-medium text-tint-err"
          >
            <MaterialIcon name="error" size={14} />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
