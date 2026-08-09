'use client'

import { motion } from 'framer-motion'
import { useLocale } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { VideoPlayer, type VideoPlayerHandle } from './VideoPlayer'
import type { RefObject } from 'react'

interface VideoPreviewProps {
  videoId?: string
  thumbnailUrl: string | null
  title: string
  channelName: string
  duration: string
  durationSeconds?: number
  isLoading?: boolean
  trimEnabled?: boolean
  trimStart?: number
  trimEnd?: number
  loopTrim?: boolean
  playerRef?: RefObject<VideoPlayerHandle | null>
  onTimeUpdate?: (seconds: number) => void
  onDuration?: (seconds: number) => void
}

export function VideoPreview({
  videoId,
  title,
  channelName,
  duration,
  isLoading = false,
  trimEnabled = false,
  trimStart = 0,
  trimEnd = 0,
  loopTrim = false,
  playerRef,
  onTimeUpdate,
  onDuration,
}: VideoPreviewProps) {
  const locale = useLocale()
  const isRtl = locale === 'ar'

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl aspect-video overflow-hidden relative bg-veil-2">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--veil-2)] via-[var(--panel-sunken)] to-[var(--veil-2)] animate-[shimmer_2s_infinite]" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-3"
    >
      {/* Interactive player */}
      {videoId ? (
        <div className="relative">
          <VideoPlayer
            ref={playerRef}
            videoId={videoId}
            trimEnabled={trimEnabled}
            trimStart={trimStart}
            trimEnd={trimEnd}
            loopTrim={loopTrim}
            onTimeUpdate={onTimeUpdate}
            onDuration={onDuration}
          />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden aspect-video bg-ink" />
      )}

      {/* Metadata strip */}
      <div
        className="flex items-start justify-between gap-3 px-1"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className={`min-w-0 ${isRtl ? 'text-right' : 'text-left'}`}>
          <h3 className="font-bold text-ink text-sm mb-1 line-clamp-2 leading-snug">
            {title}
          </h3>
          <div className="flex items-center gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <MaterialIcon name="person" size={14} className="text-ink-2" />
              {channelName}
            </span>
            <span className="flex items-center gap-1.5">
              <MaterialIcon name="schedule" size={14} className="text-ink-2" />
              {duration}
            </span>
          </div>
        </div>
        {trimEnabled && (
          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-brand bg-brand-tint px-2 py-1 rounded-full ring-1 ring-[var(--brand-tint-strong)]">
            <MaterialIcon name="auto_awesome" size={10} />
            Trim active
          </span>
        )}
      </div>
    </motion.div>
  )
}
