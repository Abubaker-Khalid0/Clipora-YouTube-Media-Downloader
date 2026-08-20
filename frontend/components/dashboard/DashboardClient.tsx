'use client'

import { useState, useEffect, useRef } from 'react'
import { UrlInputBar } from './UrlInputBar'
import { EmptyState } from './EmptyState'
import { ToolChips } from './ToolChips'
import { VideoPreview } from './VideoPreview'
import type { VideoPlayerHandle } from './VideoPlayer'

import { OutputOptions } from './OutputOptions'
import { ProcessingButton } from './ProcessingButton'

import { TrimTimeline } from './TrimTimeline'
import { TranscriptPanel } from './TranscriptPanel'
import { RecentActivity } from './RecentActivity'
import { OutputPicker, type OutputKind } from './OutputPicker'
import { ComingSoonPanel } from './ComingSoonPanel'
import type { ActivityEntry } from '@/app/[locale]/dashboard/page'
import { useJobStream } from '@/hooks/useJobStream'
import { useQueue } from './QueueProvider'
import type { JobMode } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ThumbnailFormat = 'jpg' | 'png'

type ButtonState =
  | 'idle'
  | 'initializing'
  | 'downloading'
  | 'merging'
  | 'trimming'
  | 'ready'
  | 'downloaded'

interface VideoMetadata {
  videoId: string
  title: string
  channelName: string
  durationSeconds: number
  thumbnailUrl: string
  availableQualities: Array<{ label: string; formatId: string }>
  availableAudioFormats: Array<{ label: string; format: string }>
  estimatedSizeBytes: number | null
  estimatedTimeSeconds: number | null
}

interface DashboardClientProps {
  activityEntries: ActivityEntry[]
  userId: string
}

const STATUS_MESSAGES: Record<number, string> = {
  409: 'A download is already in progress. Please wait for it to finish.',
  429: 'Too many requests. Please wait a moment before trying again.',
  500: 'Server error. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
}

/**
 * Translates the user's chosen output into the job request the backend accepts.
 *
 * Three backend constraints shape this (backend/models/schemas.py):
 *   1. trim is only valid with mode='video'
 *   2. video_type='audio_only' *requires* trim
 *   3. thumbnail mode cannot be trimmed
 *
 * So trimmed audio is expressed as video+audio_only+trim, while untrimmed audio
 * is plain mode='audio'. Keeping that translation in one function is what lets
 * the UI ask a simple question without leaking the contract's quirks.
 */
function buildJobPayload({
  output,
  includeAudio,
  trimEnabled,
  quality,
  thumbnailFormat,
}: {
  output: OutputKind
  includeAudio: boolean
  trimEnabled: boolean
  quality: string | null
  thumbnailFormat: ThumbnailFormat
}): Record<string, unknown> {
  if (output === 'image') {
    return { mode: 'thumbnail' satisfies JobMode, quality: null, thumbnailFormat }
  }

  if (output === 'audio') {
    return trimEnabled
      ? { mode: 'video' satisfies JobMode, videoType: 'audio_only', quality: null }
      : { mode: 'audio' satisfies JobMode, quality: null }
  }

  return {
    mode: 'video' satisfies JobMode,
    videoType: includeAudio ? 'video_audio' : 'video_only',
    quality,
  }
}

// Session key used to preserve the analyzed video + form state across
// full-page navigations such as switching the UI language (which remounts
// this component because the locale lives in the route segment).
const DASHBOARD_STATE_KEY = 'clipora:dashboard-state'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardClient({
  activityEntries,
  userId,
}: DashboardClientProps) {
  const t = useTranslations('dashboard')

  // ── Analysis ──────────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [video, setVideo] = useState<VideoMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Output ──────────────────────────────────────────────────────────────
  // `output` is what the user asked for; the backend mode is derived from it and
  // the trim flag in buildJobPayload(). Keeping them separate is what removed
  // the old activeFeature/mode/videoType three-way overlap.
  const [output, setOutput] = useState<OutputKind>('video')
  const [includeAudio, setIncludeAudio] = useState(true)
  const [thumbnailFormat, setThumbnailFormat] = useState<ThumbnailFormat>('jpg')
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)

  // ── Trim ──────────────────────────────────────────────────────────────────
  const [trimEnabled, setTrimEnabled] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [includeTrimTranscript, setIncludeTrimTranscript] = useState(false)

  // ── Player ──────────────────────────────────────────────────────────────
  const playerRef = useRef<VideoPlayerHandle | null>(null)
  const [playerTime, setPlayerTime] = useState(0)
  const [loopTrim, setLoopTrim] = useState(false)

  // ── Job state ─────────────────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [buttonState, setButtonState] = useState<ButtonState>('idle')
  const [fileId, setFileId] = useState<string | null>(null)


  // ── Transcript state ──────────────────────────────────────────────────────
  const [transcriptData, setTranscriptData] = useState<{
    snippets: Array<{ text: string; start: number; duration: number }>
    availableLanguages: Array<{ code: string; name: string; isGenerated: boolean }>
    language: string
    languageCode: string
    isGenerated: boolean
    videoId: string
  } | null>(null)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [transcriptFetched, setTranscriptFetched] = useState(false)

  const { stage, percent, fileId: streamFileId, error: streamError } = useJobStream(activeJobId)

  // Subtitle state lived here to drive SubtitlePanel and SubtitleOverlay. Both
  // are parked until the backend gains a burn-in step, so the state, the caption
  // fetch handler and the overlay wiring are gone rather than left dangling.

  // ── Download Queue ────────────────────────────────────────────────────────
  // Owned by QueueProvider on the dashboard shell; the list itself is rendered by
  // QueueDrawer and opened from the navbar. This component only feeds it.
  const { isProcessing: isQueueProcessing, addToQueue } = useQueue()

  // Confirms an add at the button, for the ~1.8s it takes the eye to travel to
  // the navbar counter. Also blocks a second click, since the workspace now stays
  // loaded and a double press would queue the same job twice.
  const [justQueued, setJustQueued] = useState(false)
  const queuedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetJobState = () => {
    setActiveJobId(null)
    setButtonState('idle')
    setFileId(null)
  }

  const resetAllState = () => {
    setVideo(null)
    setOutput('video')
    setIncludeAudio(true)
    setThumbnailFormat('jpg')
    setSelectedQuality(null)
    setSelectedFormat(null)
    setTrimEnabled(false)
    setTrimStart(0)
    setTrimEnd(0)
    setIncludeTrimTranscript(false)
    setLoopTrim(false)
    setPlayerTime(0)
    resetJobState()
    setError(null)
    setTranscriptData(null)
    setTranscriptError(null)
    setTranscriptFetched(false)
    try {
      sessionStorage.removeItem(DASHBOARD_STATE_KEY)
    } catch {
      // sessionStorage unavailable — nothing to clear
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  // Restore persisted video + form state on mount (e.g. after a language switch).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DASHBOARD_STATE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved && saved.video) {
        setVideo(saved.video)
        setOutput(saved.output ?? 'video')
        setIncludeAudio(saved.includeAudio ?? true)
        setThumbnailFormat(saved.thumbnailFormat ?? 'jpg')
        setSelectedQuality(saved.selectedQuality ?? null)
        setSelectedFormat(saved.selectedFormat ?? null)
        setTrimEnabled(saved.trimEnabled ?? false)
        setTrimStart(saved.trimStart ?? 0)
        setTrimEnd(saved.trimEnd ?? 0)
      }
    } catch {
      // Corrupt or unavailable storage — start fresh
    }
  }, [])

  // Persist video + form state whenever it changes so it survives navigation.
  useEffect(() => {
    if (!video) return
    try {
      sessionStorage.setItem(
        DASHBOARD_STATE_KEY,
        JSON.stringify({
          video,
          output,
          includeAudio,
          thumbnailFormat,
          selectedQuality,
          selectedFormat,
          trimEnabled,
          trimStart,
          trimEnd,
        })
      )
    } catch {
      // sessionStorage unavailable (e.g. private mode quota) — non-critical
    }
  }, [
    video,
    output,
    includeAudio,
    thumbnailFormat,
    selectedQuality,
    selectedFormat,
    trimEnabled,
    trimStart,
    trimEnd,
  ])

  // Sync SSE stage → buttonState
  useEffect(() => {
    if (!stage || !activeJobId) return

    const stageMap: Partial<Record<typeof stage, ButtonState>> = {
      initializing: 'initializing',
      extracting_info: 'initializing',
      downloading: 'downloading',
      merging: 'merging',
      trimming: 'trimming',
      finalizing: 'downloading',
    }

    if (stage === 'complete') {
      if (!streamFileId) {
        setError(t('processingFailed'))
        resetJobState()
        return
      }
      setFileId(streamFileId)
      setButtonState('ready')
      return
    }

    if (stage === 'error') {
      setError(streamError || t('processingFailed'))
      resetJobState()
      return
    }

    const mapped = stageMap[stage]
    if (mapped) setButtonState(mapped)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, activeJobId])

  // Image, transcript and subtitle cannot be trimmed — the backend rejects trim
  // outside video mode — so clear the flag when switching to them.
  //
  // Only the flag. An earlier version also zeroed trimStart/trimEnd, which left
  // trimEnd at 0 with nothing to restore it: coming back to video gave an empty
  // range, "set start" silently refused (it clamps against trimEnd - 1), and
  // submitting hit "trim_end must be greater than 00:00:00". The range is now
  // kept, so switching output and back preserves the user's selection.
  useEffect(() => {
    if (output === 'video' || output === 'audio') return
    setTrimEnabled(false)
    setLoopTrim(false)
    setIncludeTrimTranscript(false)
  }, [output])

  // Drop the "added to queue" timer if the component goes away first.
  useEffect(() => {
    return () => {
      if (queuedTimerRef.current) clearTimeout(queuedTimerRef.current)
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAnalyze = async (url: string) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (result.success) {
        const data = result.data
        const safeVideo: VideoMetadata = {
          ...data,
          availableQualities: Array.isArray(data.availableQualities) ? data.availableQualities : [],
          availableAudioFormats: Array.isArray(data.availableAudioFormats) ? data.availableAudioFormats : [],
          thumbnailUrl: data.thumbnailUrl || '',
        }
        setVideo(safeVideo)

        if (safeVideo.availableQualities.length > 0) {
          setSelectedQuality(safeVideo.availableQualities[0].formatId)
        }
        if (safeVideo.availableAudioFormats.length > 0) {
          setSelectedFormat(safeVideo.availableAudioFormats[0].format)
        }

        setTrimStart(0)
        setTrimEnd(safeVideo.durationSeconds)
      } else {
        const msg = result.error ?? result.detail ?? 'Failed to analyze video'
        console.error('[DashboardClient:handleAnalyze] error:', { status: response.status, msg })
        setError(msg)
      }
    } catch (err) {
      console.error('[DashboardClient:handleAnalyze] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleStartProcessing = async () => {
    if (!video) return

    try {
      const body: Record<string, unknown> = {
        ...buildJobPayload({
          output,
          includeAudio,
          trimEnabled,
          quality: selectedQuality,
          thumbnailFormat,
        }),
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        trimEnabled,
        trimStart: trimEnabled ? trimStart : null,
        trimEnd: trimEnabled ? trimEnd : null,
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
      }

      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const serverMsg = result.error ?? result.detail ?? null
        const friendlyMsg = STATUS_MESSAGES[response.status] ?? serverMsg ?? 'Failed to start download. Please try again.'
        console.error('[DashboardClient:handleStartProcessing] error:', { status: response.status, serverMsg })
        setError(friendlyMsg)
        return
      }

      setActiveJobId(result.data.jobId)
      setButtonState('initializing')
    } catch (err) {
      console.error('[DashboardClient:handleStartProcessing] fetch error:', err)
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
    }
  }

  const handleDownload = () => {
    if (!fileId) return
    window.location.assign(`/api/files/download/${fileId}`)
    // Auto-download trimmed transcript if checkbox was enabled
    if (includeTrimTranscript && trimEnabled) {
      handleDownloadTrimmedTranscript()
    }
    setButtonState('downloaded')
    setTimeout(resetAllState, 3000)
  }

  const handleTrimReset = () => {
    if (video) {
      setTrimStart(0)
      setTrimEnd(video.durationSeconds)
    }
    setLoopTrim(false)
  }

  // ── Player-connected trim controls ──────────────────────────────────────
  // Both buttons keep at least a 1s gap. When the playhead sits too close to the
  // opposite boundary the *other* boundary is pushed instead of the press being
  // silently ignored, which is what the old clamp did (it produced -1 and the
  // `if (clamped >= 0)` guard swallowed the click with no feedback).
  const handleSetStartToCurrent = () => {
    const duration = video?.durationSeconds ?? 0
    const current = Math.floor(playerRef.current?.getCurrentTime() ?? playerTime)
    const start = Math.max(0, Math.min(current, Math.max(0, duration - 1)))
    setTrimStart(start)
    if (trimEnd <= start) setTrimEnd(Math.min(start + 1, duration))
  }

  const handleSetEndToCurrent = () => {
    const duration = video?.durationSeconds ?? 0
    const current = Math.ceil(playerRef.current?.getCurrentTime() ?? playerTime)
    const end = Math.min(Math.max(current, 1), duration)
    setTrimEnd(end)
    if (trimStart >= end) setTrimStart(Math.max(0, end - 1))
  }

  const handlePreviewTrim = () => {
    setLoopTrim(true)
    playerRef.current?.seekTo(trimStart)
    playerRef.current?.play()
  }

  const handleTimelineSeek = (seconds: number) => {
    playerRef.current?.seekTo(seconds)
  }

  const handleButtonClick = () => {
    if (buttonState === 'idle') handleStartProcessing()
    if (buttonState === 'ready') handleDownload()
  }

  const handleAddToQueue = () => {
    if (!video) return
    const derived = buildJobPayload({
      output,
      includeAudio,
      trimEnabled,
      quality: selectedQuality,
      thumbnailFormat,
    })
    addToQueue({
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoId: video.videoId,
      videoTitle: video.title,
      thumbnailUrl: video.thumbnailUrl,
      // Queued items go through the same derivation as a direct run, so a queued
      // trimmed-audio job cannot drift from an immediate one.
      mode: derived.mode as 'video' | 'audio' | 'thumbnail',
      videoType: (derived.videoType as 'video_audio' | 'video_only' | 'audio_only') ?? 'video_audio',
      quality: selectedQuality,
      trimEnabled,
      trimStart: trimEnabled ? trimStart : null,
      trimEnd: trimEnabled ? trimEnd : null,
      thumbnailFormat,
    })

    // The workspace deliberately stays as it is. This used to call
    // resetAllState(), which threw away the analyzed video and every setting the
    // user had just chosen, silently, from a button on the opposite side of the
    // screen from the list it fed. Pasting a new link in the URL bar is the
    // explicit way to move on; a stray click no longer costs any work.
    setJustQueued(true)
    if (queuedTimerRef.current) clearTimeout(queuedTimerRef.current)
    queuedTimerRef.current = setTimeout(() => setJustQueued(false), 1800)
  }

  // ── Transcript handler ────────────────────────────────────────────────────
  const handleFetchTranscript = async (lang?: string) => {
    if (!video) return

    setIsLoadingTranscript(true)
    setTranscriptError(null)

    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          lang: lang ?? 'en',
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        setTranscriptData(result.data)
        if (!transcriptFetched) {
          setTranscriptFetched(true)
        }
      } else {
        setTranscriptError(result.error ?? 'Failed to fetch transcript')
      }
    } catch (err) {
      setTranscriptError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ── Trimmed transcript download ───────────────────────────────────────────
  // Only the setter is consumed today; the flag is kept for a future spinner.
  const [_isLoadingTrimTranscript, setIsLoadingTrimTranscript] = useState(false)

  const handleDownloadTrimmedTranscript = async () => {
    if (!video) return
    setIsLoadingTrimTranscript(true)
    try {
      const response = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          lang: 'en',
        }),
      })
      const result = await response.json()
      if (result.success && result.data?.snippets) {
        // Filter snippets to only those within trim range
        const filtered = result.data.snippets.filter(
          (s: { start: number; duration: number }) =>
            s.start >= trimStart && s.start + s.duration <= trimEnd + 1
        )
        if (filtered.length === 0) {
          setError(t('trimTranscriptEmpty'))
          return
        }
        // Generate SRT content with adjusted timestamps
        const srt = filtered
          .map((s: { text: string; start: number; duration: number }, i: number) => {
            const adjStart = s.start - trimStart
            const adjEnd = adjStart + s.duration
            return `${i + 1}\n${formatSrtTime(adjStart)} --> ${formatSrtTime(adjEnd)}\n${s.text}`
          })
          .join('\n\n')
        // Download the file
        const blob = new Blob([srt], { type: 'text/srt' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${video.title}_trim_${formatDuration(trimStart)}-${formatDuration(trimEnd)}.srt`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        setError(t('transcriptError'))
      }
    } catch {
      setError(t('transcriptError'))
    } finally {
      setIsLoadingTrimTranscript(false)
    }
  }

  function formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const hasActivity = activityEntries.length > 0

  return (
    <div className="space-y-8">

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-tint-err p-4"
          >
            <MaterialIcon name="error" size={16} className="flex-shrink-0 text-tint-err" />
            <span className="flex-1 text-sm font-medium text-tint-err">{error}</span>
            <button
              onClick={() => setError(null)}
              aria-label={t('dismiss')}
              className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-ink-4 transition-colors hover:bg-veil-2 hover:text-ink"
            >
              <MaterialIcon name="close" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!video ? (
        /* ── Empty state: hero heading → URL bar ── */
        <div className="relative flex flex-col items-center pt-6 sm:pt-12">
          <EmptyState />
          <div className="relative w-full max-w-2xl">
            <UrlInputBar
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              disabled={!!activeJobId}
            />
            {/* Capabilities sit under the input so they never separate the
                headline from the field. */}
            <div className="mt-5">
              <ToolChips />
            </div>
          </div>
        </div>
      ) : (
        /* ── Video loaded: URL bar at top → workspace grid ── */
        <div className="space-y-6">
          {/* Same max width and centring as the empty state. Unconstrained, the
              field spanned the full 1440px container and left a long dead gap
              between the placeholder and the submit button. mx-auto matters:
              without it the block aligns to the writing direction's start, which
              pinned it against the right edge in Arabic. Centring also keeps the
              field in place when a video loads instead of making it jump. */}
          <div className="mx-auto w-full max-w-2xl">
            <UrlInputBar
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              disabled={!!activeJobId}
            />
          </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          {/* ── Player column ─────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-7 xl:col-span-8">
            <VideoPreview
              videoId={video.videoId}
              thumbnailUrl={video.thumbnailUrl}
              title={video.title}
              channelName={video.channelName}
              duration={formatDuration(video.durationSeconds)}
              durationSeconds={video.durationSeconds}
              isLoading={isAnalyzing}
              trimEnabled={trimEnabled}
              trimStart={trimStart}
              trimEnd={trimEnd}
              loopTrim={loopTrim}
              playerRef={playerRef}
              onTimeUpdate={setPlayerTime}
            />

            {/* Timeline appears only once a range is actually being picked. */}
            {trimEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <TrimTimeline
                  videoDuration={video.durationSeconds}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  onTrimStartChange={setTrimStart}
                  onTrimEndChange={setTrimEnd}
                  onReset={handleTrimReset}
                  disabled={!!activeJobId}
                  currentTime={playerTime}
                  onSeek={handleTimelineSeek}
                  onSetStartToCurrent={handleSetStartToCurrent}
                  onSetEndToCurrent={handleSetEndToCurrent}
                  onPreview={handlePreviewTrim}
                />
              </motion.div>
            )}
          </div>

          {/* ── Control rail ──────────────────────────────────────
              Sticky on desktop: the tool controls used to scroll out of view as
              soon as the trim timeline or transcript grew the left column. */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:col-span-5 xl:col-span-4">
            <OutputPicker
              value={output}
              onChange={setOutput}
              disabled={!!activeJobId}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={output}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-4"
              >
                {output === 'subtitle' && <ComingSoonPanel />}

                {output === 'transcript' && (
                  <>
                    <TranscriptPanel
                      videoId={video.videoId}
                      transcriptData={transcriptData}
                      isLoading={isLoadingTranscript}
                      error={transcriptError}
                      onFetch={handleFetchTranscript}
                      onRetry={() => handleFetchTranscript(transcriptData?.languageCode)}
                      disabled={!!activeJobId}
                    />
                    {!transcriptData && !isLoadingTranscript && !transcriptError && (
                      <button
                        onClick={() => handleFetchTranscript()}
                        disabled={!!activeJobId}
                        className="w-full rounded-xl bg-[#ea2a33] py-3.5 text-sm font-bold text-white transition-colors duration-200
                                   hover:bg-[#c91e26] active:scale-[0.99]
                                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]
                                   disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {t('transcriptFetchBtn')}
                      </button>
                    )}
                  </>
                )}

                {(output === 'video' || output === 'audio' || output === 'image') && (
                  <>
                    <OutputOptions
                      output={output}
                      includeAudio={includeAudio}
                      onIncludeAudioChange={setIncludeAudio}
                      quality={selectedQuality}
                      onQualityChange={setSelectedQuality}
                      audioFormat={selectedFormat}
                      onAudioFormatChange={setSelectedFormat}
                      imageFormat={thumbnailFormat}
                      onImageFormatChange={setThumbnailFormat}
                      availableQualities={video.availableQualities}
                      availableAudioFormats={video.availableAudioFormats}
                      trimEnabled={trimEnabled}
                      onTrimEnabledChange={setTrimEnabled}
                      includeTranscript={includeTrimTranscript}
                      onIncludeTranscriptChange={setIncludeTrimTranscript}
                      estimatedSizeBytes={video.estimatedSizeBytes}
                      disabled={!!activeJobId}
                    />

                    {/* One row, with the primary action taking all remaining
                        width. items-stretch lets the queue button match the
                        primary's height without hard-coding one. Queueing is a
                        secondary action, so it is a compact icon button: at the
                        rail's ~380px there is not enough room for two labelled
                        buttons side by side without one of them wrapping. */}
                    <div className="flex items-stretch gap-2">
                      <div className="min-w-0 flex-1">
                        <ProcessingButton
                          stage={buttonState}
                          percent={percent}
                          onClick={handleButtonClick}
                          disabled={buttonState !== 'idle' && buttonState !== 'ready'}
                        />
                      </div>

                      {buttonState === 'idle' && (
                        <button
                          onClick={handleAddToQueue}
                          disabled={isQueueProcessing || justQueued}
                          aria-label={justQueued ? t('queueAdded') : t('addToQueue')}
                          title={justQueued ? t('queueAdded') : t('addToQueue')}
                          className={`flex w-12 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200
                                      active:scale-95 disabled:cursor-not-allowed
                                      ${
                                        justQueued
                                          ? 'border-solid border-brand-tint bg-brand-tint text-brand'
                                          : 'border-hairline text-ink-3 hover:border-brand-tint hover:bg-brand-tint hover:text-brand disabled:opacity-50'
                                      }`}
                        >
                          <MaterialIcon name={justQueued ? 'check' : 'playlist_add'} size={19} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
        </div>
      )}

      {/* ── History ────────────────────────────────────────────────────────
          The queue used to share this block. It does not belong here: this is a
          log of finished downloads, the queue is work that has not run yet. It
          now lives in QueueDrawer, opened from the navbar. */}
      {hasActivity && (
        <div className="border-t border-hairline pt-8">
          <RecentActivity
            entries={activityEntries}
            userId={userId}
            onReprocess={(videoId) => {
              const url = `https://www.youtube.com/watch?v=${videoId}`
              resetAllState()
              window.scrollTo({ top: 0, behavior: 'smooth' })
              handleAnalyze(url)
            }}
          />
        </div>
      )}

    </div>
  )
}