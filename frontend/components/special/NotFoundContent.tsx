"use client"

import { motion, useReducedMotion } from "framer-motion"
import Link from "next/link"

interface NotFoundContentProps {
  heading: string
  message: string
  cta: string
}

export function NotFoundContent({ heading, message, cta }: NotFoundContentProps) {
  const shouldReduceMotion = useReducedMotion()

  const initial = shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={initial}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <h1 className="text-8xl font-extrabold text-primary leading-none">{heading}</h1>
        <p className="mt-4 text-lg font-medium text-slate-600 max-w-sm mx-auto">{message}</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-white font-extrabold shadow-lg shadow-primary/25 transition-all hover:bg-[#c91e26] hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {cta}
        </Link>
      </motion.div>
    </main>
  )
}
