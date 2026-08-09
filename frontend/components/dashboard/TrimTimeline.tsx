'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrimTimelineProps {
  videoDuration: number
  trimStart: number
  trimEnd: number
  onTrimStartChange: (seconds: number) => void
  onTrimEndChange: (seconds: number) => void
  onReset: () => void
  disabled?: boolean
  /** Current playback position (seconds) for the live playhead indicator. */
  currentTime?: number
  /** Seek the connected player to an absolute time. */
  onSeek?: (seconds: number) => void
  /** Set the trim start to the current playback time. */
  onSetStartToCurrent?: () => void
  /** Set the trim end to the current playback time. */
  onSetEndToCurrent?: () => void
  /** Preview the trimmed segment (loop between start and end). */
  onPreview?: () => void
}

type HandleKind = 'start' | 'end'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Whole seconds only: the value shown, the value stored and the value sent to
 *  the backend must agree, and the API takes HH:MM:SS with no fraction. */
function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/** Parses H:MM:SS or HH:MM:SS. Returns null when the text is not a valid time. */
function parseTime(input: string): number | null {
  const match = /^(\d{1,3}):([0-5]?\d):([0-5]?\d)$/.exec(input.trim())
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

const MIN_GAP = 1

// ---------------------------------------------------------------------------
// Editable timecode field
// ---------------------------------------------------------------------------

/**
 * Time input that can actually be typed into.
 *
 * The previous version was a controlled input whose value came straight from
 * `formatTime(trimStart)` and only committed when the whole string parsed. Every
 * keystroke re-rendered the field from state, so intermediate text like
 * "00:01:3" was immediately reinterpreted and the caret jumped — typing a time
 * was effectively impossible. This keeps a local draft while focused and commits
 * on blur or Enter, reverting if the draft is invalid.
 */
function TimeField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string
  value: number
  onCommit: (seconds: number) => void
  disabled: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? formatTime(value)
  const invalid = draft !== null && parseTime(draft) === null

  const commit = () => {
    if (draft === null) return
    const parsed = parseTime(draft)
    if (parsed !== null) onCommit(parsed)
    setDraft(null)
  }

  return (
    <div>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-4">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(formatTime(value))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
            e.currentTarget.blur()
          }
          if (e.key === 'Escape') setDraft(null)
        }}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder="00:00:00"
        className={`w-full rounded-xl border bg-panel-sunken px-4 py-3 text-start font-mono text-sm text-ink-2 transition-colors duration-200
          focus:ring-2 focus:ring-[var(--brand-tint-strong)] disabled:cursor-not-allowed disabled:opacity-40
          ${invalid ? 'border-[#ea2a33]' : 'border-hairline focus:border-brand-tint'}`}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrimTimeline({
  videoDuration,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onReset,
  disabled = false,
  currentTime = 0,
  onSeek,
  onSetStartToCurrent,
  onSetEndToCurrent,
  onPreview,
}: TrimTimelineProps) {
  const t = useTranslations('dashboard')
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<HandleKind | null>(null)
  /** Suppresses the click that follows a drag release. */
  const draggedRef = useRef(false)

  // A live stream reports duration 0 from /api/analyze. Percentages would divide
  // by zero and CSS would receive `left: NaN%`, collapsing both handles.
  const measurable = Number.isFinite(videoDuration) && videoDuration > 0

  const timeAt = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0) return 0
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
      return Math.round(ratio * videoDuration)
    },
    [videoDuration]
  )

  // ── Drag ────────────────────────────────────────────────────────────────
  // Pointer events rather than mouse events: the old handlers were mouse-only,
  // so the handles could not be dragged on a touch screen at all.
  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      draggedRef.current = true
      const seconds = timeAt(e.clientX)
      if (dragging === 'start') {
        onTrimStartChange(clamp(seconds, 0, trimEnd - MIN_GAP))
      } else {
        onTrimEndChange(clamp(seconds, trimStart + MIN_GAP, videoDuration))
      }
    }
    const onUp = () => setDragging(null)

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, timeAt, trimStart, trimEnd, videoDuration, onTrimStartChange, onTrimEndChange])

  // ── Track click ─────────────────────────────────────────────────────────
  /**
   * Seeks the player. It used to move whichever handle was nearest, which meant
   * a stray click silently changed the export range and made `onSeek` — a
   * declared prop — dead code. Boundaries are set by dragging the handles or by
   * the Set start / Set end buttons; the track is for scrubbing.
   */
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !measurable) return
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    const seconds = timeAt(e.clientX)
    if (onSeek) onSeek(seconds)
    else {
      // Unwired fallback: keep the old nearest-handle behaviour.
      const toStart = Math.abs(seconds - trimStart)
      const toEnd = Math.abs(seconds - trimEnd)
      if (toStart <= toEnd) onTrimStartChange(clamp(seconds, 0, trimEnd - MIN_GAP))
      else onTrimEndChange(clamp(seconds, trimStart + MIN_GAP, videoDuration))
    }
  }

  // ── Keyboard ────────────────────────────────────────────────────────────
  const nudge = (kind: HandleKind, delta: number) => {
    if (kind === 'start') onTrimStartChange(clamp(trimStart + delta, 0, trimEnd - MIN_GAP))
    else onTrimEndChange(clamp(trimEnd + delta, trimStart + MIN_GAP, videoDuration))
  }

  const handleKey = (kind: HandleKind) => (e: React.KeyboardEvent) => {
    if (disabled) return
    const step = e.shiftKey ? 10 : 1
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        nudge(kind, -step)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        nudge(kind, step)
        break
      case 'Home':
        e.preventDefault()
        if (kind === 'start') onTrimStartChange(0)
        else onTrimEndChange(trimStart + MIN_GAP)
        break
      case 'End':
        e.preventDefault()
        if (kind === 'start') onTrimStartChange(Math.max(0, trimEnd - MIN_GAP))
        else onTrimEndChange(videoDuration)
        break
    }
  }

  // ── Geometry ────────────────────────────────────────────────────────────
  const pct = (seconds: number) => (measurable ? clamp((seconds / videoDuration) * 100, 0, 100) : 0)
  const startPct = pct(trimStart)
  const endPct = pct(trimEnd)
  const playheadPct = pct(currentTime)
  const selected = Math.max(0, trimEnd - trimStart)
  const hasPlayerControls = Boolean(
    onSeek || onSetStartToCurrent || onSetEndToCurrent || onPreview
  )

  const handleClass = [
    'absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full',
    'border-[2.5px] border-white bg-gradient-to-br from-red-400 to-red-500',
    'shadow-lg shadow-red-500/30 transition-transform duration-75 select-none touch-none',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ea2a33]',
    disabled
      ? 'cursor-not-allowed opacity-50'
      : 'cursor-grab hover:scale-125 active:scale-100 active:cursor-grabbing',
  ].join(' ')

  return (
    <div className="panel rounded-2xl p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{t('trimSegment')}</h3>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-ink-4">
            {t('trimPrecision')}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <span
            dir="ltr"
            className="rounded-lg bg-panel-sunken px-2.5 py-1 font-mono text-xs font-semibold text-ink-4"
          >
            {formatTime(selected)}
          </span>
          <button
            onClick={onReset}
            disabled={disabled}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-4 transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MaterialIcon name="restart_alt" size={14} />
            {t('trimReset')}
          </button>
        </div>
      </div>

      {!measurable ? (
        <p className="flex items-center gap-2 rounded-xl bg-tint-warn p-3 text-[13px] font-medium text-tint-warn">
          <MaterialIcon name="warning" size={15} />
          {t('trimUnavailable')}
        </p>
      ) : (
        <>
          {/* Track */}
          <div className="mb-6">
            <div
              ref={trackRef}
              onClick={handleTrackClick}
              className="relative mx-2 h-2.5 cursor-pointer select-none rounded-full bg-veil-2"
            >
              {/* Selected range. One layer: the previous markup stacked two divs
                  with identical geometry, painting the same band twice. */}
              <div
                className="absolute h-full rounded-full bg-brand-tint-strong"
                style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 z-20 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow"
                style={{ left: `${playheadPct}%` }}
              />

              <div
                role="slider"
                aria-label={t('trimStartHandle')}
                aria-valuemin={0}
                aria-valuemax={Math.floor(videoDuration)}
                aria-valuenow={Math.floor(trimStart)}
                aria-valuetext={formatTime(trimStart)}
                aria-orientation="horizontal"
                tabIndex={disabled ? -1 : 0}
                onPointerDown={() => !disabled && setDragging('start')}
                onKeyDown={handleKey('start')}
                className={handleClass}
                style={{ left: `${startPct}%`, zIndex: 10 }}
              />

              <div
                role="slider"
                aria-label={t('trimEndHandle')}
                aria-valuemin={0}
                aria-valuemax={Math.floor(videoDuration)}
                aria-valuenow={Math.floor(trimEnd)}
                aria-valuetext={formatTime(trimEnd)}
                aria-orientation="horizontal"
                tabIndex={disabled ? -1 : 0}
                onPointerDown={() => !disabled && setDragging('end')}
                onKeyDown={handleKey('end')}
                className={handleClass}
                style={{ left: `${endPct}%`, zIndex: 10 }}
              />
            </div>
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-4">
            <TimeField
              label={t('startTime')}
              value={trimStart}
              disabled={disabled}
              onCommit={(seconds) => onTrimStartChange(clamp(seconds, 0, trimEnd - MIN_GAP))}
            />
            <TimeField
              label={t('endTime')}
              value={trimEnd}
              disabled={disabled}
              onCommit={(seconds) =>
                onTrimEndChange(clamp(seconds, trimStart + MIN_GAP, videoDuration))
              }
            />
          </div>

          {trimStart >= trimEnd && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand">
              <MaterialIcon name="error" size={14} />
              {t('trimValidation')}
            </p>
          )}
        </>
      )}

      {/* Player-connected controls */}
      {hasPlayerControls && measurable && (
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-hairline pt-4">
          <button
            onClick={onSetStartToCurrent}
            disabled={disabled}
            title={t('trimSetStartHint')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-panel-sunken px-2 py-2.5 text-[11px] font-semibold text-ink-2 ring-1 ring-hairline transition-all hover:bg-veil-2 hover:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MaterialIcon name="flag" size={14} />
            {t('trimSetStart')}
          </button>

          <button
            onClick={onPreview}
            disabled={disabled || trimStart >= trimEnd}
            title={t('trimPreviewHint')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-[#ea2a33] px-2 py-2.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-[#c91e26] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MaterialIcon name="play_arrow" size={14} filled />
            {t('trimPreview')}
          </button>

          <button
            onClick={onSetEndToCurrent}
            disabled={disabled}
            title={t('trimSetEndHint')}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-panel-sunken px-2 py-2.5 text-[11px] font-semibold text-ink-2 ring-1 ring-hairline transition-all hover:bg-veil-2 hover:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MaterialIcon name="sports_score" size={14} />
            {t('trimSetEnd')}
          </button>
        </div>
      )}
    </div>
  )
}
