'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useTheme } from '@/components/ui/ThemeProvider'

/**
 * ThemeToggle — single-button light/dark switch.
 *
 * Renders a fixed-size placeholder until mounted. The server cannot know the
 * visitor's stored theme, so drawing the sun/moon before hydration would show
 * the wrong icon and then swap; reserving the space avoids both the wrong icon
 * and a layout shift.
 */

const EASE = [0.22, 1, 0.36, 1] as const

export function ThemeToggle({ className = '' }: { className?: string }) {
  const t = useTranslations('common.theme')
  const { theme, toggle } = useTheme()
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  // Deferred to a frame callback rather than set straight in the effect body,
  // which would be a synchronous setState (react-hooks/set-state-in-effect).
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const base =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ' +
    'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900 ' +
    'dark:border-white/10 dark:text-white/60 dark:hover:border-white/25 dark:hover:text-white ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]'

  if (!mounted) {
    // aria-hidden: it is inert, so it must not be announced or focusable.
    return <div className={`${base} ${className}`} aria-hidden="true" />
  }

  const isDark = theme === 'dark'
  const label = isDark ? t('switchToLight') : t('switchToDark')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`${base} ${className}`}
    >
      <motion.span
        key={theme}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: EASE }}
        className="flex items-center justify-center"
      >
        <MaterialIcon name={isDark ? 'light_mode' : 'dark_mode'} size={17} />
      </motion.span>
    </button>
  )
}
