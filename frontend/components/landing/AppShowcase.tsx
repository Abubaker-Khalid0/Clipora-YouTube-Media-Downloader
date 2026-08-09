'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * AppShowcase — a self-playing mock of the real Clipora workflow.
 *
 * Replaces the old hero's blurred stock photo: instead of decorating the page,
 * it demonstrates the product (paste → analyze → pick quality → download).
 *
 * Everything is drawn with CSS so the hero has zero external image requests and
 * no layout shift. The loop pauses on `prefers-reduced-motion` and settles on
 * the final "ready" frame.
 */

const DEMO_URL = 'youtube.com/watch?v=dQw4w9WgXcQ'

type Phase = 'typing' | 'analyzing' | 'analyzed' | 'processing' | 'done'

// Phase durations in ms. Typing is derived from the URL length.
const TYPE_SPEED = 45
const DURATIONS: Record<Phase, number> = {
  typing: DEMO_URL.length * TYPE_SPEED + 400,
  analyzing: 1500,
  analyzed: 1900,
  processing: 3200,
  done: 2600,
}

const NEXT_PHASE: Record<Phase, Phase> = {
  typing: 'analyzing',
  analyzing: 'analyzed',
  analyzed: 'processing',
  processing: 'done',
  done: 'typing',
}

const QUALITIES = ['2160p', '1440p', '1080p', '720p'] as const
const SELECTED_QUALITY = '1080p'

const EASE = [0.22, 1, 0.36, 1] as const

export function AppShowcase() {
  const t = useTranslations('landing.showcase')
  const reduceMotion = useReducedMotion()

  const [phase, setPhase] = useState<Phase>(reduceMotion ? 'done' : 'typing')
  const [typed, setTyped] = useState(reduceMotion ? DEMO_URL : '')
  const [progress, setProgress] = useState(reduceMotion ? 100 : 0)

  // ── Phase driver ────────────────────────────────────────────────────────
  // The loop's visible state is reset here, inside the timeout, rather than in
  // the effect bodies below: a synchronous setState in an effect body triggers
  // a cascading render (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (reduceMotion) return
    const timer = setTimeout(() => {
      const next = NEXT_PHASE[phase]
      if (next === 'typing') {
        setTyped('')
        setProgress(0)
      }
      setPhase(next)
    }, DURATIONS[phase])
    return () => clearTimeout(timer)
  }, [phase, reduceMotion])

  // ── Typing animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion || phase !== 'typing') return
    let index = 0
    const id = setInterval(() => {
      index += 1
      setTyped(DEMO_URL.slice(0, index))
      if (index >= DEMO_URL.length) clearInterval(id)
    }, TYPE_SPEED)
    return () => clearInterval(id)
  }, [phase, reduceMotion])

  // ── Progress animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion || phase !== 'processing') return

    const started = Date.now()
    const id = setInterval(() => {
      const ratio = Math.min((Date.now() - started) / DURATIONS.processing, 1)
      // Ease-out so it decelerates near the end, like a real download.
      setProgress(Math.round((1 - Math.pow(1 - ratio, 2)) * 100))
    }, 60)
    return () => clearInterval(id)
  }, [phase, reduceMotion])

  const isAnalyzed = phase === 'analyzed' || phase === 'processing' || phase === 'done'

  return (
    <div className="relative mx-auto w-full max-w-[880px]">
      {/* Ambient glow behind the window */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-16 -top-10 bottom-0 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(234,42,51,0.28),transparent_65%)] blur-2xl"
      />

      <div className="surface-solid noise-overlay relative overflow-hidden rounded-2xl shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]">
        {/* ── Window chrome ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-hairline bg-veil px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-black/40 px-3 py-1">
            <MaterialIcon name="lock" size={11} className="text-emerald-400/70" />
            <span className="font-mono text-[10px] tracking-wide text-ink-4">clipora.app</span>
          </div>
          <StatusPill phase={phase} label={t(`status.${phase}`)} />
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="space-y-4 p-4 sm:p-6">
          {/* URL bar */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-hairline bg-black/40 px-3.5 py-3">
              <MaterialIcon
                name="link"
                size={16}
                className={phase === 'typing' ? 'text-ink-4' : 'text-[#ea2a33]'}
              />
              <span className="truncate font-mono text-xs text-ink-2 sm:text-[13px]">
                {typed || <span className="text-ink-4">{t('urlPlaceholder')}</span>}
              </span>
              {phase === 'typing' && !reduceMotion && (
                <motion.span
                  aria-hidden="true"
                  className="h-4 w-[2px] shrink-0 bg-[#ea2a33]"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
                />
              )}
            </div>
            <div
              className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition-colors ${
                phase === 'analyzing'
                  ? 'bg-veil-3 text-ink-3'
                  : 'bg-[#ea2a33] text-white glow-brand'
              }`}
            >
              {phase === 'analyzing' ? (
                <>
                  <MaterialIcon name="progress_activity" size={14} className="animate-spin" />
                  {t('analyzing')}
                </>
              ) : (
                <>
                  <MaterialIcon name="bolt" size={14} filled />
                  {t('analyze')}
                </>
              )}
            </div>
          </div>

          {/* Result panel */}
          <div className="grid gap-4 sm:grid-cols-[1.35fr_1fr]">
            {/* Video preview */}
            <div className="relative aspect-video overflow-hidden rounded-xl border border-hairline bg-gradient-to-br from-[#1c1c22] via-[#141419] to-[#0c0c10]">
              <AnimatePresence mode="wait">
                {isAnalyzed ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="absolute inset-0"
                  >
                    {/* Abstract "frame" — colour bands evoke video without an image request */}
                    <div className="absolute inset-0 bg-[conic-gradient(from_210deg_at_35%_30%,#ea2a33_0deg,#ff6a3d_70deg,#7850ff_180deg,#0c0c10_300deg)] opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="absolute inset-0 rounded-full bg-veil-3 pulse-ring" aria-hidden="true" />
                      <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-xl">
                        <MaterialIcon name="play_arrow" size={24} className="text-[#ea2a33]" filled />
                      </span>
                    </div>

                    <div className="absolute inset-x-3 bottom-3">
                      <p className="truncate text-[11px] font-bold text-ink">{t('videoTitle')}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-3">
                        <span>{t('videoChannel')}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">3:33</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                  >
                    <MaterialIcon
                      name={phase === 'analyzing' ? 'progress_activity' : 'movie'}
                      size={22}
                      className={`text-ink-4 ${phase === 'analyzing' ? 'animate-spin' : ''}`}
                    />
                    <span className="text-[10px] font-medium text-ink-4">{t('previewHint')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-veil p-3.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-4">
                {t('qualityLabel')}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {QUALITIES.map((quality, index) => {
                  const active = isAnalyzed && quality === SELECTED_QUALITY
                  return (
                    <motion.span
                      key={quality}
                      initial={false}
                      animate={{
                        opacity: isAnalyzed ? 1 : 0.25,
                        scale: active ? 1 : 0.97,
                      }}
                      transition={{ duration: 0.35, delay: isAnalyzed ? index * 0.06 : 0, ease: EASE }}
                      className={`rounded-md border px-2 py-1 font-mono text-[10px] ${
                        active
                          ? 'border-[#ea2a33] bg-[#ea2a33]/15 text-[#ff8a8a]'
                          : 'border-hairline bg-black/30 text-ink-4'
                      }`}
                    >
                      {quality}
                    </motion.span>
                  )
                })}
              </div>

              <div className="mt-auto space-y-2">
                {/* Progress */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-ink-3">
                    {phase === 'done' ? t('stage.ready') : t(`stage.${phase}`)}
                  </span>
                  <span className="font-mono text-ink-3">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-veil-3">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[#ff6a3d] to-[#ea2a33]"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.25, ease: 'linear' }}
                  />
                </div>

                {/* Download button */}
                <motion.div
                  animate={{
                    opacity: phase === 'done' ? 1 : 0.3,
                    y: phase === 'done' ? 0 : 4,
                  }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[11px] font-bold ${
                    phase === 'done'
                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
                      : 'bg-veil-2 text-ink-4'
                  }`}
                >
                  <MaterialIcon
                    name={phase === 'done' ? 'download_done' : 'download'}
                    size={13}
                  />
                  {phase === 'done' ? t('readyFile') : t('waiting')}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Live status chip in the window title bar. */
function StatusPill({ phase, label }: { phase: Phase; label: string }) {
  const tone =
    phase === 'done'
      ? 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/25'
      : phase === 'processing' || phase === 'analyzing'
        ? 'text-amber-300 bg-amber-500/10 ring-amber-400/25'
        : 'text-ink-3 bg-veil-2 ring-hairline'

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ring-1 sm:inline-flex ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}
