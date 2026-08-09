'use client'

import { useMemo } from 'react'
import type { SubtitleLine, SubtitleStyle, SubtitleFont, SubtitleSize, SubtitlePosition } from './SubtitlePanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtitleOverlayProps {
  lines: SubtitleLine[]
  currentTime: number
  style: SubtitleStyle
  font: SubtitleFont
  size: SubtitleSize
  position: SubtitlePosition
  color?: string
}

// ---------------------------------------------------------------------------
// Style presets — maps each style to CSS classes/inline styles
// ---------------------------------------------------------------------------

function getStyleClasses(style: SubtitleStyle, font: SubtitleFont, size: SubtitleSize): string {
  const fontFamily = font === 'arabic'
    ? "font-['Cairo',sans-serif]"
    : "font-['Montserrat',sans-serif]"

  const fontSize = {
    small: 'text-sm sm:text-base',
    medium: 'text-base sm:text-lg',
    large: 'text-lg sm:text-2xl',
  }[size]

  const base = `${fontFamily} ${fontSize} text-center leading-snug max-w-[90%] transition-all duration-200`

  switch (style) {
    case 'classic':
      return `${base} text-white font-bold [text-shadow:_2px_2px_4px_rgba(0,0,0,0.8),_-1px_-1px_2px_rgba(0,0,0,0.5)]`
    case 'tiktok':
      return `${base} text-white font-extrabold uppercase tracking-wide [text-shadow:_3px_3px_0px_rgba(0,0,0,1),_-1px_-1px_0px_rgba(0,0,0,1)]`
    case 'modern-box':
      return `${base} text-white font-semibold bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg`
    case 'cinematic':
      return `${base} text-amber-100 font-medium italic tracking-wide [text-shadow:_0_0_20px_rgba(251,191,36,0.3),_2px_2px_4px_rgba(0,0,0,0.8)]`
    case 'outline':
      return `${base} text-white font-extrabold [-webkit-text-stroke:_2px_black] [paint-order:stroke_fill]`
    case 'bold-center':
      return `${base} text-white font-black text-xl sm:text-3xl [text-shadow:_3px_3px_6px_rgba(0,0,0,0.9)]`
    default:
      return `${base} text-white font-bold`
  }
}

function getPositionClasses(position: SubtitlePosition): string {
  switch (position) {
    case 'top':
      return 'top-[10%] left-1/2 -translate-x-1/2'
    case 'center':
      return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
    case 'bottom':
    default:
      return 'bottom-[12%] left-1/2 -translate-x-1/2'
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubtitleOverlay({
  lines,
  currentTime,
  style,
  font,
  size,
  position,
}: SubtitleOverlayProps) {
  // Find the active subtitle line based on current playback time
  const activeLine = useMemo(() => {
    if (!lines || lines.length === 0) return null
    return lines.find((line) => currentTime >= line.start && currentTime <= line.end) ?? null
  }, [lines, currentTime])

  if (!activeLine || !activeLine.text) return null

  const styleClasses = getStyleClasses(style, font, size)
  const positionClasses = getPositionClasses(position)

  return (
    <div
      className={`absolute z-30 pointer-events-none ${positionClasses}`}
      dir={font === 'arabic' ? 'rtl' : 'ltr'}
    >
      <span className={styleClasses}>
        {activeLine.text}
      </span>
    </div>
  )
}
