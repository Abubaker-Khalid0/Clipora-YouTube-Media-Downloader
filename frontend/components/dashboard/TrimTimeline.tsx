'use client'

import { useTranslations } from 'next-intl'
import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'

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
}

type DraggingHandle = 'start' | 'end' | null

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3 && parts.every((p) => !Number.isNaN(p))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return -1
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function xToTime(clientX: number, rect: DOMRect, duration: number): number {
  const percent = clamp((clientX - rect.left) / rect.width, 0, 1)
  return percent * duration
}

// ---------------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------------

interface HandleProps {
  percent: number
  label: string
  ariaMin: number
  ariaMax: number
  ariaNow: number
  disabled: boolean
  onDrag: (handle: DraggingHandle) => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

function Handle({
  percent,
  label,
  ariaMin,
  ariaMax,
  ariaNow,
  disabled,
  onDrag,
  onKeyDown,
}: HandleProps) {
  const handle = label === 'Trim start handle' ? 'start' : 'end'

  return (
    <div
      role="slider"
      aria-label={label}
      aria-valuemin={ariaMin}
      aria-valuemax={ariaMax}
      aria-valuenow={Math.round(ariaNow)}
      tabIndex={disabled ? -1 : 0}
      onMouseDown={() => !disabled && onDrag(handle)}
      onKeyDown={onKeyDown}
      className={[
        'absolute top-1/2 w-5 h-5 rounded-full',
        'bg-gradient-to-br from-red-400 to-red-500 border-[2.5px] border-white',
        'shadow-lg shadow-red-500/30',
        'transition-transform duration-75 select-none',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-grab active:cursor-grabbing hover:scale-125 active:scale-100 hover:shadow-xl hover:shadow-red-500/40',
      ].join(' ')}
      style={{
        left: `${percent}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    />
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
}: TrimTimelineProps) {
  const t = useTranslations('dashboard')
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<DraggingHandle>(null)

  const MIN_GAP = 1

  // ── Drag logic ─────────────────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const t2 = xToTime(e.clientX, rect, videoDuration)

      if (dragging === 'start') {
        onTrimStartChange(clamp(t2, 0, trimEnd - MIN_GAP))
      } else {
        onTrimEndChange(clamp(t2, trimStart + MIN_GAP, videoDuration))
      }
    },
    [dragging, videoDuration, trimStart, trimEnd, onTrimStartChange, onTrimEndChange]
  )

  const handleMouseUp = useCallback(() => setDragging(null), [])

  useEffect(() => {
    if (!dragging) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // ── Track click ────────────────────────────────────────────────────────────

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const clickedTime = xToTime(e.clientX, rect, videoDuration)
    const distStart = Math.abs(clickedTime - trimStart)
    const distEnd = Math.abs(clickedTime - trimEnd)

    if (distStart <= distEnd) {
      onTrimStartChange(clamp(clickedTime, 0, trimEnd - MIN_GAP))
    } else {
      onTrimEndChange(clamp(clickedTime, trimStart + MIN_GAP, videoDuration))
    }
  }

  // ── Keyboard handlers ──────────────────────────────────────────────────────

  const handleStartKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowLeft') onTrimStartChange(clamp(trimStart - 1, 0, trimEnd - MIN_GAP))
    if (e.key === 'ArrowRight') onTrimStartChange(clamp(trimStart + 1, 0, trimEnd - MIN_GAP))
  }

  const handleEndKey = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowLeft') onTrimEndChange(clamp(trimEnd - 1, trimStart + MIN_GAP, videoDuration))
    if (e.key === 'ArrowRight') onTrimEndChange(clamp(trimEnd + 1, trimStart + MIN_GAP, videoDuration))
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const startPercent = (trimStart / videoDuration) * 100
  const endPercent = (trimEnd / videoDuration) * 100
  const durationSeconds = trimEnd - trimStart

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm ring-1 ring-slate-50">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{t('trimSegment')}</h3>
          <p className="text-[11px] text-slate-300 uppercase tracking-widest mt-1">
            {t('trimPrecision')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selected duration badge */}
          <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
            {formatTime(durationSeconds > 0 ? durationSeconds : 0)}
          </span>
          <button
            onClick={onReset}
            disabled={disabled}
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('trimReset')}
          </button>
        </div>
      </div>

      {/* Timeline track */}
      <div className="mb-6">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-2.5 bg-slate-100 rounded-full mx-2 cursor-pointer select-none"
        >
          {/* Selected range */}
          <div
            className="absolute h-full bg-red-100 rounded-full"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />

          {/* Active range line */}
          <div
            className="absolute h-full bg-gradient-to-r from-red-400/30 to-red-500/30 rounded-full"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />

          <Handle
            percent={startPercent}
            label="Trim start handle"
            ariaMin={0}
            ariaMax={videoDuration}
            ariaNow={trimStart}
            disabled={disabled}
            onDrag={setDragging}
            onKeyDown={handleStartKey}
          />

          <Handle
            percent={endPercent}
            label="Trim end handle"
            ariaMin={0}
            ariaMax={videoDuration}
            ariaNow={trimEnd}
            disabled={disabled}
            onDrag={setDragging}
            onKeyDown={handleEndKey}
          />
        </div>
      </div>

      {/* Time inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">
            {t('startTime')}
          </label>
          <input
            type="text"
            value={formatTime(trimStart)}
            onChange={(e) => {
              const val = parseTime(e.target.value)
              if (val >= 0 && val < trimEnd) onTrimStartChange(val)
            }}
            disabled={disabled}
            className="w-full bg-slate-50/80 border border-slate-200/80 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            placeholder="00:00:00"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2">
            {t('endTime')}
          </label>
          <input
            type="text"
            value={formatTime(trimEnd)}
            onChange={(e) => {
              const val = parseTime(e.target.value)
              if (val > trimStart && val <= videoDuration) onTrimEndChange(val)
            }}
            disabled={disabled}
            className="w-full bg-slate-50/80 border border-slate-200/80 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-red-100 focus:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
            placeholder="00:00:00"
          />
        </div>
      </div>

      {trimStart >= trimEnd && (
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-red-500">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          {t('trimValidation')}
        </div>
      )}

    </div>
  )
}