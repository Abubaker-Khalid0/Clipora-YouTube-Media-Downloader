'use client'

import { useState, useEffect } from 'react'
import { UrlInputBar } from './UrlInputBar'
import { EmptyState } from './EmptyState'
import { VideoPreview } from './VideoPreview'
import { WelcomeState } from './WelcomeState'
import { OutputControls } from './OutputControls'
import { ProcessingButton } from './ProcessingButton'
import { ZeroCreditsModal } from './ZeroCreditsModal'
import { TrimTimeline } from './TrimTimeline'
import { useJobStream } from '@/hooks/useJobStream'
import { useCredits } from '@/hooks/useCredits'
import { calculateCreditCost } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DownloadMode = 'video' | 'audio' | 'thumbnail'
type ThumbnailFormat = 'jpg' | 'png'
type VideoType = 'video_audio' | 'video_only' | 'audio_only'

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
  isFirstLogin: boolean
  firstName: string
  credits: number
}

const STATUS_MESSAGES: Record<number, string> = {
  402: "You don't have enough credits for this download.",
  409: 'A download is already in progress. Please wait for it to finish.',
  429: 'Too many requests. Please wait a moment before trying again.',
  500: 'Server error. Please try again later.',
  503: 'Service temporarily unavailable. Please try again later.',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardClient({
  isFirstLogin,
  firstName,
  credits: initialCredits,
}: DashboardClientProps) {
  const t = useTranslations('dashboard')

  // ── Analysis ──────────────────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [video, setVideo] = useState<VideoMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Credits ───────────────────────────────────────────────────────────────
  const { credits, loading: creditsLoading, hasError: creditsError } = useCredits()
  const displayCredits = creditsLoading ? initialCredits : credits

  // ── Output config ─────────────────────────────────────────────────────────
  const [mode, setMode] = useState<DownloadMode>('video')
  const [videoType, setVideoType] = useState<VideoType>('video_audio')
  const [thumbnailFormat, setThumbnailFormat] = useState<ThumbnailFormat>('jpg')
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null)

  // ── Trim ──────────────────────────────────────────────────────────────────
  const [trimEnabled, setTrimEnabled] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)

  // ── Job state ─────────────────────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [buttonState, setButtonState] = useState<ButtonState>('idle')
  const [fileId, setFileId] = useState<string | null>(null)
  const [showZeroCredits, setShowZeroCredits] = useState(false)

  const { stage, percent, fileId: streamFileId, error: streamError } = useJobStream(activeJobId)

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetJobState = () => {
    setActiveJobId(null)
    setButtonState('idle')
    setFileId(null)
  }

  const resetAllState = () => {
    setVideo(null)
    setMode('video')
    setVideoType('video_audio')
    setThumbnailFormat('jpg')
    setSelectedQuality(null)
    setSelectedFormat(null)
    setTrimEnabled(false)
    setTrimStart(0)
    setTrimEnd(0)
    resetJobState()
    setError(null)
  }

  // ── Effects ───────────────────────────────────────────────────────────────

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

  // Reset trim when switching away from video mode
  useEffect(() => {
    if (mode !== 'video') {
      setTrimEnabled(false)
      setTrimStart(0)
      setTrimEnd(0)
    }
  }, [mode])

  // Reset audio_only when trim is disabled (audio_only requires trim)
  useEffect(() => {
    if (!trimEnabled && videoType === 'audio_only') {
      setVideoType('video_audio')
    }
  }, [trimEnabled, videoType])

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

    const cost = calculateCreditCost(mode, selectedQuality, trimEnabled)

    if (credits < cost) {
      setShowZeroCredits(true)
      return
    }

    try {
      const body: Record<string, unknown> = {
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        mode,
        quality: selectedQuality,
        trimEnabled,
        trimStart: trimEnabled ? trimStart : null,
        trimEnd: trimEnabled ? trimEnd : null,
        videoTitle: video.title,
        thumbnailUrl: video.thumbnailUrl,
      }

      // Only send mode-specific fields to keep the payload clean
      if (mode === 'video') {
        body.videoType = videoType
      }
      if (mode === 'thumbnail') {
        body.thumbnailFormat = thumbnailFormat
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
    window.location.href = `/api/files/download/${fileId}`
    setButtonState('downloaded')
    setTimeout(resetAllState, 3000)
  }

  const handleTrimReset = () => {
    if (video) {
      setTrimStart(0)
      setTrimEnd(video.durationSeconds)
    }
  }

  const handleButtonClick = () => {
    if (buttonState === 'idle') handleStartProcessing()
    if (buttonState === 'ready') handleDownload()
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showWelcome = isFirstLogin && !video

  return (
    <div className="space-y-6">

      {showWelcome && (
        <WelcomeState firstName={firstName} credits={displayCredits} />
      )}

      {/* Credits error banner */}
      <AnimatePresence>
        {creditsError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3.5 ring-1 ring-amber-100/50"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-amber-700 text-sm font-medium">{t('creditsLoadError')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <UrlInputBar
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        disabled={!!activeJobId}
      />

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-4 ring-1 ring-red-100/50"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-red-600 text-sm font-medium">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-300 hover:text-red-400 text-xs font-medium transition-colors"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!video ? (
        <EmptyState />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* ── Left column: Video Preview + Trim Timeline ──── */}
          <div className="lg:col-span-2 space-y-4">
            <VideoPreview
              videoId={video.videoId}
              thumbnailUrl={video.thumbnailUrl}
              title={video.title}
              channelName={video.channelName}
              duration={formatDuration(video.durationSeconds)}
              durationSeconds={video.durationSeconds}
              isLoading={isAnalyzing}
              trimEnabled={mode === 'video' && trimEnabled}
              trimStart={trimStart}
              trimEnd={trimEnd}
            />

            {/* Trim Timeline — appears below video when enabled */}
            {mode === 'video' && trimEnabled && (
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
                />
              </motion.div>
            )}
          </div>

          {/* ── Right column: Controls + Trim Toggle + Button ── */}
          <div className="lg:col-span-1 space-y-4">
            <OutputControls
              mode={mode}
              onModeChange={setMode}
              videoType={videoType}
              onVideoTypeChange={setVideoType}
              thumbnailFormat={thumbnailFormat}
              onThumbnailFormatChange={setThumbnailFormat}
              selectedQuality={selectedQuality}
              onQualityChange={setSelectedQuality}
              selectedFormat={selectedFormat}
              onFormatChange={setSelectedFormat}
              availableQualities={video.availableQualities}
              availableAudioFormats={video.availableAudioFormats}
              estimatedSizeBytes={video.estimatedSizeBytes}
              estimatedTimeSeconds={video.estimatedTimeSeconds}
              trimEnabled={trimEnabled}
              onTrimEnabledChange={setTrimEnabled}
              disabled={!!activeJobId}
            />

            <ProcessingButton
              stage={buttonState}
              percent={percent}
              onClick={handleButtonClick}
              disabled={buttonState !== 'idle' && buttonState !== 'ready'}
            />
          </div>
        </motion.div>
      )}

      {showZeroCredits && (
        <ZeroCreditsModal onClose={() => setShowZeroCredits(false)} />
      )}

    </div>
  )
}