'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { QueueItem } from '@/hooks/useDownloadQueue'
import { useQueue } from './QueueProvider'

/**
 * QueueDrawer — the download queue as an overlay panel.
 *
 * Replaces the full-width card that sat at the bottom of the dashboard. Two
 * problems that layout could not solve:
 *   1. It shared a block with "Recent activity", implying a pending batch and a
 *      finished-downloads log are the same kind of thing.
 *   2. At 1440px a row held a title and one status word, so ~700px of every row
 *      was dead space with the remove button flung to the far edge.
 *
 * A ~420px drawer sizes itself to the content instead, and being an overlay it
 * costs the page no vertical space and stays reachable from anywhere.
 *
 * Rendered through a portal so it clears the sticky navbar's stacking context
 * and cannot be clipped by a transformed ancestor.
 */

function formatTime(seconds: number | null): string {
  if (seconds == null) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const STATUS_ICON: Record<QueueItem['status'], { name: string; className: string }> = {
  waiting: { name: 'schedule', className: 'text-ink-4' },
  processing: { name: 'progress_activity', className: 'text-brand animate-spin' },
  complete: { name: 'check_circle', className: 'text-tint-ok' },
  failed: { name: 'error', className: 'text-tint-err' },
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function QueueRow({
  item,
  index,
  onRemove,
  onDownload,
}: {
  item: QueueItem
  index: number
  onRemove: (id: string) => void
  onDownload: (id: string) => void
}) {
  const t = useTranslations('dashboard')
  const status = STATUS_ICON[item.status]

  const stageLabel = (() => {
    switch (item.status) {
      case 'waiting':
        return t('queueWaiting')
      case 'complete':
        return t('queueDone')
      case 'failed':
        return item.error ?? t('queueFailed')
      case 'processing':
        switch (item.stage) {
          case 'initializing':
          case 'extracting_info':
            return t('queueStageInitializing')
          case 'downloading':
            return t('queueStageDownloading', { percent: item.progress })
          case 'merging':
            return t('queueStageMerging')
          case 'trimming':
            return t('queueStageTrimming')
          case 'finalizing':
            return t('queueStageFinalizing')
          default:
            return t('queueProcessing')
        }
    }
  })()

  const isTrimmed = item.trimEnabled && item.trimStart != null && item.trimEnd != null

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.15) }}
      className="group flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-veil"
    >
      {/* Thumbnail — the old row had none, so a queue of five videos was five
          lines of truncated text with nothing to tell them apart. */}
      <div className="relative h-11 w-[74px] flex-shrink-0 overflow-hidden rounded-lg bg-panel-sunken ring-1 ring-hairline">
        {item.thumbnailUrl ? (
          <Image src={item.thumbnailUrl} alt="" fill unoptimized className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <MaterialIcon name="video_file" size={18} className="text-ink-4" />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-ink-2" title={item.videoTitle}>
          {item.videoTitle}
        </p>

        <div className="mt-1 flex items-center gap-1.5">
          <MaterialIcon name={status.name} size={13} className={status.className} />
          <span
            className={`truncate text-[11px] font-medium ${
              item.status === 'failed'
                ? 'text-tint-err'
                : item.status === 'complete'
                  ? 'text-tint-ok'
                  : 'text-ink-4'
            }`}
          >
            {stageLabel}
          </span>
          {isTrimmed && (
            <span className="flex-shrink-0 rounded bg-veil-2 px-1.5 py-0.5 text-[10px] tabular-nums text-ink-4">
              {formatTime(item.trimStart)}–{formatTime(item.trimEnd)}
            </span>
          )}
        </div>

        {/* Full-width bar rather than the old 64px stub in the row's tail. */}
        {item.status === 'processing' && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-veil-2">
            <motion.div
              className="h-full rounded-full bg-[#ea2a33]"
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>

      {/* Actions sit next to the content, not at the panel's far edge. */}
      <div className="flex flex-shrink-0 items-start">
        {item.status === 'complete' && (
          <button
            onClick={() => onDownload(item.id)}
            aria-label={t('download')}
            title={t('download')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 transition-colors hover:bg-brand-tint hover:text-brand"
          >
            <MaterialIcon name="download" size={15} />
          </button>
        )}
        {(item.status === 'waiting' || item.status === 'failed') && (
          <button
            onClick={() => onRemove(item.id)}
            aria-label={t('queueRemove')}
            title={t('queueRemove')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-4 opacity-0 transition-all hover:bg-veil-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          >
            <MaterialIcon name="close" size={15} />
          </button>
        )}
      </div>
    </motion.li>
  )
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export function QueueDrawer() {
  const t = useTranslations('dashboard')
  const isRtl = useLocale() === 'ar'
  const {
    queue,
    isProcessing,
    isOpen,
    closeQueue,
    startQueue,
    removeFromQueue,
    clearQueue,
    downloadFile,
    downloadAllReady,
  } = useQueue()

  const closeRef = useRef<HTMLButtonElement>(null)

  // Escape to close, scroll lock, and focus moved into the panel so keyboard
  // users are not left tabbing through the page behind the overlay.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeQueue()
    }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, closeQueue])

  // No portal target while server-rendering. Nothing is lost: the drawer only
  // has content once `isOpen` is true, and that can only come from a click.
  if (typeof document === 'undefined') return null

  const waiting = queue.filter((q) => q.status === 'waiting').length
  const done = queue.filter((q) => q.status === 'complete').length
  const failed = queue.filter((q) => q.status === 'failed').length
  // `end-0` puts the panel on the trailing edge, which is the left in Arabic, so
  // the slide-in offset has to follow the writing direction too.
  const offscreen = isRtl ? '-100%' : '100%'

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeQueue}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t('queueTitle')}
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="absolute inset-y-0 end-0 flex w-full max-w-[420px] flex-col border-s border-hairline bg-panel shadow-2xl"
          >
            {/* Header */}
            <header className="flex flex-shrink-0 items-center gap-2.5 border-b border-hairline bg-panel-sunken px-4 py-3.5">
              <MaterialIcon name="playlist_play" size={18} className="text-ink-3" />
              <h2 className="text-sm font-bold text-ink">{t('queueTitle')}</h2>
              <span className="rounded-full bg-veil-2 px-2 py-0.5 text-[11px] font-medium text-ink-4">
                {t('queueCount', { count: queue.length })}
              </span>

              <div className="ms-auto flex items-center gap-1">
                {queue.length > 0 && (
                  <button
                    onClick={clearQueue}
                    aria-label={t('queueClear')}
                    title={t('queueClear')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-4 transition-colors hover:bg-veil-2 hover:text-brand"
                  >
                    <MaterialIcon name="delete_sweep" size={17} />
                  </button>
                )}
                <button
                  ref={closeRef}
                  onClick={closeQueue}
                  aria-label={t('queueClose')}
                  title={t('queueClose')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-4 transition-colors hover:bg-veil-2 hover:text-ink"
                >
                  <MaterialIcon name="close" size={17} />
                </button>
              </div>
            </header>

            {/* Items */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {queue.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-panel-sunken">
                    <MaterialIcon name="playlist_add" size={22} className="text-ink-4" />
                  </span>
                  <p className="text-sm font-semibold text-ink-2">{t('queueEmpty')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-4">{t('queueEmptyHint')}</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  <AnimatePresence initial={false}>
                    {queue.map((item, index) => (
                      <QueueRow
                        key={item.id}
                        item={item}
                        index={index}
                        onRemove={removeFromQueue}
                        onDownload={downloadFile}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer */}
            {queue.length > 0 && (
              <footer className="flex-shrink-0 space-y-2.5 border-t border-hairline bg-panel-sunken px-4 py-3">
                <p className="text-[11px] font-medium text-ink-4">
                  {isProcessing
                    ? t('queueRunning', { done, total: queue.length })
                    : t('queueSummary', { waiting, done, failed })}
                </p>

                <div className="flex items-center gap-2">
                  {!isProcessing && waiting > 0 && (
                    <button
                      onClick={startQueue}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ea2a33] py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[#c91e26] active:scale-[0.99]
                                 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]"
                    >
                      <MaterialIcon name="play_arrow" size={17} />
                      {t('queueStart')}
                    </button>
                  )}
                  {done > 0 && (
                    <button
                      onClick={downloadAllReady}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hairline bg-panel py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-veil-2"
                    >
                      <MaterialIcon name="download" size={16} />
                      {t('queueDownloadAll')}
                    </button>
                  )}
                </div>
              </footer>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
