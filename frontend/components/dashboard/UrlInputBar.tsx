'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Search, Link2 } from 'lucide-react'
import { extractYouTubeId } from '@/lib/utils'

interface UrlInputBarProps {
  onAnalyze: (url: string) => Promise<void>
  isAnalyzing: boolean
  disabled?: boolean
}

export function UrlInputBar({ onAnalyze, isAnalyzing, disabled = false }: UrlInputBarProps) {
  const t = useTranslations('dashboard')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (value: string) => {
    setUrl(value)
    setError(null)
    
    // Validate YouTube URL if not empty
    if (value.trim() && !extractYouTubeId(value)) {
      setError('Invalid YouTube URL')
    }
  }

  const handleSubmit = async () => {
    const videoId = extractYouTubeId(url)
    if (!videoId) {
      setError('Invalid YouTube URL')
      return
    }

    setError(null)
    await onAnalyze(url)
  }

  const isValid = url.trim() && extractYouTubeId(url) !== null

  return (
    <div className="w-full">
      <div 
        className={`
          relative bg-white rounded-2xl border-2 flex items-center gap-3 px-5 overflow-hidden
          transition-all duration-300 ease-out
          ${isFocused 
            ? 'border-red-200 shadow-xl shadow-red-500/5 ring-4 ring-red-50' 
            : 'border-slate-200/80 shadow-lg shadow-slate-200/30 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/50'
          }
          ${error ? 'border-red-300 ring-4 ring-red-50' : ''}
        `}
      >
        {/* Search icon */}
        <div className={`flex-shrink-0 transition-colors duration-200 ${isFocused ? 'text-red-400' : 'text-slate-300'}`}>
          {url.trim() ? (
            <Link2 className="w-5 h-5" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </div>

        <input
          type="text"
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && isValid && !isAnalyzing && !disabled && handleSubmit()}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={t('placeholder')}
          disabled={isAnalyzing || disabled}
          className="flex-1 border-none focus:ring-0 text-slate-800 placeholder-slate-300 py-4 text-base font-medium bg-transparent outline-none disabled:opacity-50 tracking-tight"
        />
        
        <button
          onClick={handleSubmit}
          disabled={!isValid || isAnalyzing || disabled}
          className={`
            flex-shrink-0 text-white font-bold px-6 py-2.5 rounded-xl 
            transition-all duration-300 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none
            flex items-center gap-2 text-sm
            ${isAnalyzing
              ? 'bg-slate-400 shadow-md'
              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 active:scale-95'
            }
          `}
        >
          {isAnalyzing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {isAnalyzing ? t('analyzing') : t('analyze')}
        </button>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 mt-2.5 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <p className="text-red-500 text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  )
}
