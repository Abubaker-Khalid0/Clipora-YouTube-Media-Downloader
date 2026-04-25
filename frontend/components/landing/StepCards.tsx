'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// ── Framer Motion variants (design-reference.md §Landing Page) ───────────────
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
}

interface StepCardsProps {
  children: ReactNode
}

/**
 * StepCards — "use client" Framer Motion wrapper for HowItWorks step cards.
 *
 * Animates children with a staggered scroll-triggered reveal.
 * viewport.once = true prevents re-triggering on scroll back up (FR-006).
 */
export function StepCards({ children }: StepCardsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      {children}
    </motion.div>
  )
}

/**
 * StepCard — individual animated step card within StepCards.
 */
export function StepCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={cardVariants}
      className="group flex flex-col items-center gap-4 rounded-2xl p-6 text-center
                 glass-panel transition-all duration-300 hover:shadow-xl"
    >
      {children}
    </motion.div>
  )
}
