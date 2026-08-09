'use client'

import { motion, useReducedMotion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Reveal — scroll-triggered entrance wrapper used across the landing page.
 *
 * Keeps motion consistent (one easing curve, one distance) instead of every
 * section inventing its own. Falls back to a plain fade when the visitor has
 * "reduce motion" enabled at the OS level.
 */

const EASE = [0.22, 1, 0.36, 1] as const

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 28, y: 0 },
  right: { x: -28, y: 0 },
  none: { x: 0, y: 0 },
}

interface RevealProps {
  children: ReactNode
  /** Entrance direction. Defaults to rising from below. */
  direction?: Direction
  /** Seconds to wait before animating — use to stagger siblings manually. */
  delay?: number
  duration?: number
  className?: string
  /** Render as a list item instead of a div (for semantic lists). */
  as?: 'div' | 'li' | 'section'
}

export function Reveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.7,
  className,
  as = 'div',
}: RevealProps) {
  const reduceMotion = useReducedMotion()
  const offset = OFFSET[direction]

  const MotionTag = motion[as]

  return (
    <MotionTag
      className={className}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  )
}

/**
 * Container/item variant pair for staggered grids. Spread `staggerContainer`
 * onto the parent and `staggerItem` onto each child.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}
