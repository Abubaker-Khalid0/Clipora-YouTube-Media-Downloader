'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// ── Framer Motion variants (design-reference.md §Landing Page) ───────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
}

interface HeroAnimationsProps {
  children: ReactNode
}

/**
 * HeroAnimations — "use client" Framer Motion wrapper for HeroSection.
 *
 * Wraps hero children in a staggered fadeInUp animation that triggers on mount.
 * Each direct child that is a <motion.div> will stagger by 0.12s.
 *
 * Usage: wrap individual hero elements (badge, h1, subtitle, CTA) in
 * <HeroItem> exported from this file for the stagger to apply to each.
 */
export function HeroAnimations({ children }: HeroAnimationsProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center gap-6 w-full"
    >
      {children}
    </motion.div>
  )
}

/**
 * HeroItem — individual animated child for use inside HeroAnimations.
 */
export function HeroItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}
