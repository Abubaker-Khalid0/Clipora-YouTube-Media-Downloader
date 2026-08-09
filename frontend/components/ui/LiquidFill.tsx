'use client'

/**
 * LiquidFill — the rising-water layer shared by the analyse and process buttons.
 *
 * Render it inside a `liquid-host` (relative + overflow-hidden) element. It draws
 * only the water; the host owns the shape, so the same component works in a
 * circle or a pill.
 *
 * `level` drives the surface height. Pass `indeterminate` when no percentage
 * exists yet — the level then breathes instead of pretending to know progress,
 * which is the honest signal for "working, duration unknown".
 */

interface LiquidFillProps {
  /** 0–100. Ignored when `indeterminate` is set. */
  level?: number
  indeterminate?: boolean
  /** Any CSS colour. Drives both the body and the wave crests. */
  color?: string
  className?: string
}

export function LiquidFill({
  level = 0,
  indeterminate = false,
  color = 'rgba(255, 255, 255, 0.3)',
  className = '',
}: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(100, level))

  return (
    <span
      aria-hidden="true"
      className={`liquid-fill ${indeterminate ? 'liquid-fill--tide' : ''} ${className}`}
      style={
        {
          '--level': indeterminate ? 50 : clamped,
          '--liquid': color,
        } as React.CSSProperties
      }
    >
      <span className="liquid-wave liquid-wave--a" />
      <span className="liquid-wave liquid-wave--b" />
    </span>
  )
}
