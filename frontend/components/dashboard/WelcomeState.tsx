'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Sparkles, Coins } from 'lucide-react'

interface WelcomeStateProps {
  firstName: string
  credits: number
}

export function WelcomeState({ firstName, credits }: WelcomeStateProps) {
  const t = useTranslations('dashboard')

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="text-center py-10"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 12 }}
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 mb-6"
      >
        <Sparkles className="w-7 h-7 text-red-400" />
      </motion.div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">
        {t('welcome', { name: firstName })}
      </h1>
      
      <div className="flex items-center justify-center gap-2 mb-2">
        <Coins className="w-4 h-4 text-amber-500" />
        <p className="text-base text-slate-500 font-medium">
          {t('welcomeSub', { credits })}
        </p>
      </div>
      
      <p className="text-sm text-slate-300 max-w-md mx-auto">
        {t('welcomeHint')}
      </p>
    </motion.div>
  )
}
