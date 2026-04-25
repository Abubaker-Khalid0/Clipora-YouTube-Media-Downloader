'use client'

import { useTranslations } from 'next-intl'
import { X, AlertCircle, Coins } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ZeroCreditsModalProps {
  onClose: () => void
}

export function ZeroCreditsModal({ onClose }: ZeroCreditsModalProps) {
  const t = useTranslations('dashboard')

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white rounded-2xl p-8 max-w-[400px] w-full mx-auto shadow-2xl shadow-slate-900/10 z-10 ring-1 ring-slate-100"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-lg transition-all duration-150"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="text-center space-y-5">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 mx-auto">
              <div className="relative">
                <Coins className="w-8 h-8 text-amber-400" />
                <AlertCircle className="w-4 h-4 text-red-400 absolute -top-1 -right-1 bg-white rounded-full" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">
                {t('zeroCreditsTitle')}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                {t('zeroCreditsMessage')}
              </p>
            </div>

            {/* Primary Action */}
            <button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300 active:scale-[0.98] text-sm"
            >
              {t('zeroCreditsAction')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
