'use client'

import { useTranslations } from 'next-intl'
import { Film, Settings2, ArrowUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function EmptyState() {
  const t = useTranslations('dashboard')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Video preview placeholder */}
      <div className="lg:col-span-2">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-2xl border-2 border-dashed border-slate-200 aspect-video flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-slate-50/80 to-white relative overflow-hidden"
        >
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Film className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-400 text-center font-semibold text-sm">
              {t('emptyVideoHint')}
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-slate-300">
              <ArrowUp className="w-3.5 h-3.5 animate-bounce" />
              <span className="text-xs font-medium">{t('pasteUrl') || 'Paste a YouTube URL above'}</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Settings placeholder */}
      <div className="lg:col-span-1">
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col items-center justify-center gap-4 min-h-[300px] shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
            <Settings2 className="w-7 h-7 text-slate-200" />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-300 font-bold">
              {t('emptySettingsHint')}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
