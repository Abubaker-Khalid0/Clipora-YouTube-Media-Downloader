'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { LiquidFill } from '@/components/ui/LiquidFill'
import { SHOWCASE_VIDEOS, thumbnailUrl } from '@/lib/showcaseVideos'

/**
 * AppShowcase — a self-playing mock of the real dashboard.
 *
 * Rewritten twice over. The first version was a blurred stock photo; the second
 * invented its own layout (a lone quality strip and a conic-gradient rectangle
 * standing in for the video) and was written for a dark canvas only, so on the
 * light theme its `bg-black/40` fills rendered as grey slabs — visibly broken.
 *
 * This version mirrors what the app actually renders: the URL row, the player
 * with its real thumbnail and metadata, the output picker, the quality control
 * and the liquid progress button. The data comes from lib/showcaseVideos.ts,
 * which holds values captured from the app's own /api/analyze.
 */

type Phase = 'typing' | 'analyzing' | 'ready' | 'processing' | 'done'

const NEXT_PHASE: Record<Phase, Phase> = {
  typing: 'analyzing',
  analyzing: 'ready',
  ready: 'processing',
  processing: 'done',
  done: 'typing',
}

const TYPE_SPEED = 42

const DURATIONS: Record<Phase, number> = {
  typing: 1500,
  analyzing: 1400,
  ready: 1800,
  processing: 3000,
  done: 2400,
}

const OUTPUTS = [
  { key: 'modeVideo', icon: 'movie' },
  { key: 'modeAudio', icon: 'music_note' },
  { key: 'modeThumbnail', icon: 'image' },
  { key: 'modeTranscript', icon: 'description' },
] as const

const EASE = [0.22, 1, 0.36, 1] as const

export function AppShowcase() {
  const t = useTranslations('landing.showcase')
  const td = useTranslations('dashboard')
  const reduceMotion = useReducedMotion()

  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(reduceMotion ? 'done' : 'typing')
  const [typed, setTyped] = useState(reduceMotion ? SHOWCASE_VIDEOS[0].videoId.length : 0)
  const [progress, setProgress] = useState(reduceMotion ? 100 : 0)

  const video = SHOWCASE_VIDEOS[index]
  const url = `youtube.com/watch?v=${video.videoId}`
  const analysed = phase === 'ready' || phase === 'processing' || phase === 'done'

  // ── Phase driver ────────────────────────────────────────────────────────
  // State for the next cycle is reset inside the timeout rather than in a
  // separate effect body, which would be a synchronous setState during render.
  useEffect(() => {
    if (reduceMotion) return
    const timer = setTimeout(() => {
      const next = NEXT_PHASE[phase]
      if (next === 'typing') {
        setTyped(0)
        setProgress(0)
        setIndex((i) => (i + 1) % SHOWCASE_VIDEOS.length)
      }
      setPhase(next)
    }, DURATIONS[phase])
    return () => clearTimeout(timer)
  }, [phase, reduceMotion])

  // ── Typing ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion || phase !== 'typing') return
    const id = setInterval(() => {
      setTyped((n) => {
        if (n >= url.length) {
          clearInterval(id)
          return n
        }
        return n + 1
      })
    }, TYPE_SPEED)
    return () => clearInterval(id)
  }, [phase, reduceMotion, url.length])

  // ── Progress ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reduceMotion || phase !== 'processing') return
    const started = Date.now()
    const id = setInterval(() => {
      const ratio = Math.min((Date.now() - started) / DURATIONS.processing, 1)
      setProgress(Math.round((1 - Math.pow(1 - ratio, 2)) * 100))
    }, 60)
    return () => clearInterval(id)
  }, [phase, reduceMotion])

  return (
    <div className="relative mx-auto w-full max-w-[960px]">
      {/* Ambient brand light behind the window */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-12 -top-8 bottom-0 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,rgba(234,42,51,0.22),transparent_65%)] blur-2xl"
      />

      <div className="surface-solid noise-overlay relative overflow-hidden rounded-2xl shadow-[0_40px_120px_-40px_rgba(0,0,0,0.45)]">
        {/* ── Browser chrome ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-hairline bg-veil px-4 py-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
            <span className="h-2.5 w-2.5 rounded-full bg-veil-3" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-veil-2 px-3 py-1">
            <MaterialIcon name="lock" size={11} className="text-tint-ok" />
            <span dir="ltr" className="font-mono text-[10px] tracking-wide text-ink-4">
              clipora.app
            </span>
          </div>
          <StatusPill phase={phase} label={t(`status.${phase}`)} />
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* ── URL row — mirrors UrlInputBar ─────────────────────────── */}
          <div className="flex h-12 items-center gap-2 rounded-xl border border-hairline bg-panel ps-4 pe-2 shadow-sm shadow-[var(--shadow-tint)]">
            <MaterialIcon
              name={typed > 0 ? 'link' : 'search'}
              size={17}
              className={typed > 0 ? 'text-brand' : 'text-ink-4'}
            />
            <span
              dir="ltr"
              className="flex min-w-0 flex-1 items-center truncate font-mono text-[13px] text-ink-2"
            >
              {typed > 0 ? (
                url.slice(0, typed)
              ) : (
                <span className="text-ink-4">{td('placeholder')}</span>
              )}
              {phase === 'typing' && !reduceMotion && (
                <motion.span
                  aria-hidden="true"
                  className="ms-px inline-block h-4 w-[2px] shrink-0 bg-[#ea2a33]"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
                />
              )}
            </span>
            <span
              className={`liquid-host inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white ${
                phase === 'analyzing' ? 'bg-[#8f1319]' : 'bg-[#ea2a33]'
              }`}
            >
              {phase === 'analyzing' && <LiquidFill indeterminate color="rgba(255,255,255,0.32)" />}
              <MaterialIcon
                name={phase === 'analyzing' ? 'more_horiz' : 'arrow_forward'}
                size={17}
                className="relative z-10 rtl:rotate-180"
              />
            </span>
          </div>

          {/* ── Workspace — mirrors the 12-column dashboard grid ──────── */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Player column */}
            <div className="space-y-3 lg:col-span-7">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-hairline bg-panel-sunken">
                <AnimatePresence mode="wait">
                  {analysed ? (
                    <motion.div
                      key={video.videoId}
                      initial={{ opacity: 0, scale: 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className="absolute inset-0"
                    >
                      {/* The real frame, not a stand-in gradient. */}
                      <Image
                        src={thumbnailUrl(video.videoId)}
                        alt=""
                        fill
                        sizes="(max-width: 1024px) 100vw, 560px"
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-xl">
                        <MaterialIcon
                          name="play_arrow"
                          size={24}
                          className="text-[#ea2a33]"
                          filled
                        />
                      </span>

                      <span
                        dir="ltr"
                        className="absolute bottom-2 end-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white"
                      >
                        {video.duration}
                      </span>
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
                      <span className="text-[10px] font-medium text-ink-4">
                        {t('previewHint')}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Real title and channel */}
              <div className="min-h-[2.75rem]">
                <AnimatePresence mode="wait">
                  {analysed && (
                    <motion.div
                      key={video.videoId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <p className="truncate text-[13px] font-bold text-ink">{video.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-4">
                        <MaterialIcon name="person" size={12} />
                        <span className="truncate">{video.channel}</span>
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="font-mono">
                          {video.audio}
                        </span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Control rail */}
            <div className="space-y-3 lg:col-span-5">
              {/* Output picker — same question the dashboard asks */}
              <div className="rounded-xl border border-hairline bg-panel p-2.5">
                <p className="section-label mb-2 px-0.5">{td('outputQuestion')}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {OUTPUTS.map((o, i) => (
                    <span
                      key={o.key}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                        i === 0
                          ? 'bg-brand-tint text-ink ring-1 ring-[var(--brand-tint-strong)]'
                          : 'text-ink-4'
                      }`}
                    >
                      <MaterialIcon
                        name={o.icon}
                        size={14}
                        className={i === 0 ? 'text-brand' : 'text-ink-4'}
                      />
                      <span className="truncate">{td(o.key)}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Quality — real values from the analysed video */}
              <div className="rounded-xl border border-hairline bg-panel p-2.5">
                <p className="section-label mb-2 px-0.5">{td('qualityLabel')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {video.qualities.map((q, i) => (
                    <motion.span
                      key={`${video.videoId}-${q}`}
                      initial={false}
                      animate={{ opacity: analysed ? 1 : 0.3 }}
                      transition={{ duration: 0.3, delay: analysed ? i * 0.05 : 0 }}
                      dir="ltr"
                      className={`rounded-md border px-2 py-1 font-mono text-[10px] ${
                        analysed && i === 0
                          ? 'border-[var(--brand-tint-strong)] bg-brand-tint text-brand'
                          : 'border-hairline bg-panel-sunken text-ink-4'
                      }`}
                    >
                      {q}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Processing button — same liquid indicator as the app */}
              <div
                className={`liquid-host flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-white ${
                  phase === 'done'
                    ? 'bg-emerald-600'
                    : phase === 'processing'
                      ? 'bg-[#8f1319]'
                      : 'bg-[#ea2a33]'
                }`}
              >
                {phase === 'processing' && (
                  <LiquidFill level={progress} color="rgba(255,255,255,0.26)" />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <MaterialIcon
                    name={
                      phase === 'done'
                        ? 'download_done'
                        : phase === 'processing'
                          ? 'water_drop'
                          : 'auto_awesome'
                    }
                    size={16}
                    filled={phase === 'processing' || phase === 'done'}
                  />
                  <span className="tabular-nums">
                    {phase === 'done'
                      ? td('downloadReady')
                      : phase === 'processing'
                        ? td('downloading', { percent: progress })
                        : td('startProcessing')}
                  </span>
                </span>
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
      ? 'bg-tint-ok text-tint-ok'
      : phase === 'analyzing' || phase === 'processing'
        ? 'bg-tint-warn text-tint-warn'
        : 'bg-veil-2 text-ink-4'

  return (
    <span
      className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider sm:inline-flex ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}
