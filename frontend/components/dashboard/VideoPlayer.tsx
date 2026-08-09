'use client'

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import ReactPlayer from 'react-player'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoPlayerHandle {
  /** Seek the player to an absolute time in seconds. */
  seekTo: (seconds: number) => void
  /** Start playback. */
  play: () => void
  /** Pause playback. */
  pause: () => void
  /** Current playback time in seconds. */
  getCurrentTime: () => number
}

interface VideoPlayerProps {
  videoId: string
  /** Trim region start (seconds) — drawn as an overlay on the seek bar. */
  trimStart?: number
  /** Trim region end (seconds) — drawn as an overlay on the seek bar. */
  trimEnd?: number
  /** When true, the trim region is highlighted on the seek bar. */
  trimEnabled?: boolean
  /** Loop playback within the trim region (preview mode). */
  loopTrim?: boolean
  /** Fired on every time update so parents can sync a playhead indicator. */
  onTimeUpdate?: (seconds: number) => void
  /** Fired once the real duration is known. */
  onDuration?: (seconds: number) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const PLAYBACK_RATES = [0.5, 1, 1.5, 2] as const

/** YouTube's timeupdate is coarse, so a poll drives the playhead and the loop. */
const POLL_MS = 100

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      videoId,
      trimStart = 0,
      trimEnd = 0,
      trimEnabled = false,
      loopTrim = false,
      onTimeUpdate,
      onDuration,
    },
    ref
  ) {
    const t = useTranslations('dashboard')

    // react-player v3 forwards an HTMLVideoElement-compatible ref.
    const playerRef = useRef<HTMLVideoElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    const [ready, setReady] = useState(false)
    const [failed, setFailed] = useState(false)
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [volume, setVolume] = useState(0.8)
    const [played, setPlayed] = useState(0)
    const [duration, setDuration] = useState(0)
    const [playbackRate, setPlaybackRate] = useState<number>(1)
    const [seeking, setSeeking] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)

    // ── Live values for the poll ────────────────────────────────────────────
    // The polling interval is created once and never torn down between plays,
    // so anything it reads must come from a ref. Reading state directly froze
    // `seeking` and `duration` at their values from the first play: the loop
    // stopped working and the poll fought the user's drag by resetting `played`
    // every 100ms.
    const live = useRef({ seeking, duration, loopTrim, trimEnabled, trimStart, trimEnd })
    const onTimeUpdateRef = useRef(onTimeUpdate)

    // Written in an effect, not during render: mutating a ref while rendering is
    // unsafe under concurrent rendering (react-hooks/refs).
    useEffect(() => {
      live.current = { seeking, duration, loopTrim, trimEnabled, trimStart, trimEnd }
      onTimeUpdateRef.current = onTimeUpdate
    }, [seeking, duration, loopTrim, trimEnabled, trimStart, trimEnd, onTimeUpdate])

    /**
     * Single time-sync path, shared by the poll and the element's timeupdate.
     * Loop enforcement lives here so it runs at poll resolution; when it only
     * ran on the element event the playhead overshot the trim end noticeably
     * before snapping back.
     */
    const syncTime = useCallback(() => {
      const el = playerRef.current
      if (!el) return
      const current = el.currentTime
      if (current == null || !Number.isFinite(current)) return

      const s = live.current

      if (s.loopTrim && s.trimEnabled && s.trimEnd > s.trimStart) {
        if (current >= s.trimEnd || current < s.trimStart) {
          el.currentTime = s.trimStart
          onTimeUpdateRef.current?.(s.trimStart)
          if (s.duration > 0) setPlayed(s.trimStart / s.duration)
          return
        }
      }

      if (!s.seeking && s.duration > 0) setPlayed(current / s.duration)
      onTimeUpdateRef.current?.(current)
    }, [])

    // ── Polling lifecycle ──────────────────────────────────────────────────
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const startPolling = useCallback(() => {
      if (pollingRef.current) return
      pollingRef.current = setInterval(syncTime, POLL_MS)
    }, [syncTime])

    const stopPolling = useCallback(() => {
      if (!pollingRef.current) return
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }, [])

    useEffect(() => stopPolling, [stopPolling])

    // ── Imperative API used by the trim timeline ───────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        seekTo: (seconds: number) => {
          const el = playerRef.current
          if (!el) return
          el.currentTime = seconds
          if (live.current.duration > 0) setPlayed(seconds / live.current.duration)
        },
        play: () => {
          void playerRef.current?.play()
        },
        pause: () => {
          playerRef.current?.pause()
        },
        getCurrentTime: () => playerRef.current?.currentTime ?? 0,
      }),
      []
    )

    // ── Playback ───────────────────────────────────────────────────────────
    // The element is the single source of truth: `playing` is not passed as a
    // prop, so play/pause cannot be driven declaratively and imperatively at
    // once. State is reconciled from the element's own events.
    const togglePlay = useCallback(() => {
      const el = playerRef.current
      if (!el) return
      if (playing) el.pause()
      else void el.play()
    }, [playing])

    const handleDurationChange = useCallback(() => {
      const d = playerRef.current?.duration
      if (d != null && Number.isFinite(d) && d > 0) {
        setDuration(d)
        onDuration?.(d)
      }
    }, [onDuration])

    // ── Seeking ────────────────────────────────────────────────────────────
    const commitSeek = useCallback((fraction: number) => {
      const el = playerRef.current
      const d = live.current.duration
      if (!el || d <= 0) return
      el.currentTime = fraction * d
    }, [])

    /**
     * Pointer events cover mouse, touch and pen. The previous version listened
     * for mouseDown/mouseUp only, so on a touch screen the thumb moved but the
     * video never seeked, and arrow-key seeking did nothing at all.
     */
    const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const fraction = parseFloat(e.target.value)
      setPlayed(fraction)
      // Keyboard and click-to-position produce a change with no drag in
      // progress; commit immediately so those paths actually seek.
      if (!seeking) commitSeek(fraction)
    }

    const handleSeekPointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
      setSeeking(false)
      commitSeek(parseFloat((e.target as HTMLInputElement).value))
    }

    // ── Volume ─────────────────────────────────────────────────────────────
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      setVolume(v)
      setMuted(v === 0)
    }

    // ── Fullscreen ─────────────────────────────────────────────────────────
    const toggleFullscreen = () => {
      const node = containerRef.current
      if (!node) return
      if (document.fullscreenElement) void document.exitFullscreen()
      else void node.requestFullscreen?.()
    }

    // Without this the icon never changed, and pressing Esc left it showing
    // "enter fullscreen" while still full screen.
    useEffect(() => {
      const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
      document.addEventListener('fullscreenchange', onChange)
      return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    // ── Trim overlay geometry ──────────────────────────────────────────────
    const showTrim = trimEnabled && trimEnd > trimStart && duration > 0
    const trimStartPct = duration > 0 ? (trimStart / duration) * 100 : 0
    const trimEndPct = duration > 0 ? (trimEnd / duration) * 100 : 0

    return (
      <div
        ref={containerRef}
        className="group relative aspect-video overflow-hidden rounded-2xl bg-black shadow-2xl shadow-[var(--shadow-tint)] ring-1 ring-black/5"
      >
        <ReactPlayer
          ref={playerRef}
          src={`https://www.youtube.com/watch?v=${videoId}`}
          muted={muted}
          volume={volume}
          playbackRate={playbackRate}
          controls={false}
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
          onReady={() => setReady(true)}
          onPlay={() => {
            setPlaying(true)
            setFailed(false)
            startPolling()
          }}
          onPause={() => {
            setPlaying(false)
            stopPolling()
          }}
          onEnded={() => {
            setPlaying(false)
            stopPolling()
          }}
          // Previously unhandled: a video that forbids embedding left `ready`
          // false forever, so the loading spinner span for ever with no reason
          // given.
          onError={() => {
            setFailed(true)
            stopPolling()
          }}
          onTimeUpdate={syncTime}
          onDurationChange={handleDurationChange}
          config={{ youtube: { rel: 0 } }}
        />

        {/* Failure state */}
        {failed && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/90 px-6 text-center">
            <MaterialIcon name="error" size={26} className="text-white/50" />
            <p className="max-w-xs text-[13px] font-medium leading-relaxed text-white/70">
              {t('playerUnavailable')}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 transition-colors hover:bg-white/20"
            >
              <MaterialIcon name="open_in_new" size={13} />
              {t('playerOpenOnYoutube')}
            </a>
          </div>
        )}

        {/* Loading */}
        {!ready && !failed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
            <MaterialIcon
              name="progress_activity"
              size={32}
              className="animate-spin text-white/40"
            />
          </div>
        )}

        {/* Click-anywhere play/pause */}
        {!failed && (
          <button
            onClick={togglePlay}
            aria-label={playing ? t('playerPause') : t('playerPlay')}
            className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center"
          >
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm transition-all duration-300 ${
                playing
                  ? 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                  : 'opacity-100'
              }`}
            >
              <MaterialIcon
                name={playing ? 'pause' : 'play_arrow'}
                size={28}
                className="text-white"
                filled
              />
            </span>
          </button>
        )}

        {/* Controls */}
        {!failed && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-within:opacity-100">
            {/* Seek bar */}
            <div className="relative mb-2 px-1">
              {showTrim && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-red-500/40"
                  style={{
                    insetInlineStart: `${trimStartPct}%`,
                    width: `${trimEndPct - trimStartPct}%`,
                  }}
                />
              )}
              <input
                type="range"
                min={0}
                max={0.999999}
                step="any"
                value={played}
                onPointerDown={() => setSeeking(true)}
                onPointerUp={handleSeekPointerUp}
                onChange={handleSeekInput}
                aria-label={t('playerSeek')}
                aria-valuetext={formatTime(played * duration)}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-red-500
                           [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none
                           [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:shadow-md"
              />
            </div>

            <div className="flex items-center gap-3 text-white">
              <button
                onClick={togglePlay}
                aria-label={playing ? t('playerPause') : t('playerPlay')}
                className="transition-colors hover:text-red-400"
              >
                <MaterialIcon name={playing ? 'pause' : 'play_arrow'} size={16} />
              </button>

              {/* Volume */}
              <div className="group/vol flex items-center gap-1.5">
                <button
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? t('playerUnmute') : t('playerMute')}
                  className="transition-colors hover:text-red-400"
                >
                  <MaterialIcon
                    name={muted || volume === 0 ? 'volume_off' : 'volume_up'}
                    size={16}
                  />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label={t('playerVolume')}
                  className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 transition-all duration-200 group-hover/vol:w-16 focus:w-16
                             [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5
                             [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                             [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* Time — forced LTR so 1:05 / 3:33 is not mirrored in Arabic */}
              <span dir="ltr" className="font-mono text-[11px] tabular-nums text-white/90">
                {formatTime(played * duration)} / {formatTime(duration)}
              </span>

              {showTrim && (
                <span
                  dir="ltr"
                  className="hidden items-center gap-1 text-[10px] font-semibold text-red-300 sm:flex"
                >
                  <MaterialIcon name="content_cut" size={12} />
                  {formatTime(trimStart)} – {formatTime(trimEnd)}
                </span>
              )}

              {/* ms-auto, not ml-auto: in Arabic the group belongs on the left. */}
              <div className="ms-auto flex items-center gap-3">
                <button
                  onClick={() => {
                    const i = PLAYBACK_RATES.indexOf(
                      playbackRate as (typeof PLAYBACK_RATES)[number]
                    )
                    setPlaybackRate(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length])
                  }}
                  aria-label={t('playerSpeed')}
                  className="font-mono text-[11px] font-bold tabular-nums transition-colors hover:text-red-400"
                >
                  {playbackRate}x
                </button>

                <button
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t('playerExitFullscreen') : t('playerFullscreen')}
                  className="transition-colors hover:text-red-400"
                >
                  <MaterialIcon
                    name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    size={16}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
