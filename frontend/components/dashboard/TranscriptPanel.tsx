'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranscriptSnippet {
  text: string
  start: number
  duration: number
}

interface TranscriptLanguage {
  code: string
  name: string
  isGenerated: boolean
}

interface TranscriptData {
  snippets: TranscriptSnippet[]
  availableLanguages: TranscriptLanguage[]
  language: string
  languageCode: string
  isGenerated: boolean
  videoId: string
}

interface TranscriptPanelProps {
  videoId: string
  transcriptData: TranscriptData | null
  isLoading: boolean
  error: string | null
  onFetch: (lang?: string) => void
  onRetry: () => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function generateSRT(snippets: TranscriptSnippet[]): string {
  return snippets
    .map((s, i) => {
      const start = formatSRTTime(s.start)
      const end = formatSRTTime(s.start + s.duration)
      return `${i + 1}\n${start} --> ${end}\n${s.text}\n`
    })
    .join('\n')
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const RTL_LANGUAGE_CODES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ku'])

function isRtlLanguage(langCode: string): boolean {
  // Check exact match or prefix (e.g. 'ar-SA' → 'ar')
  return RTL_LANGUAGE_CODES.has(langCode) || RTL_LANGUAGE_CODES.has(langCode.split('-')[0])
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits text into parts, marking which parts match the search query.
 * Returns an array of { text, isMatch } segments for highlighted rendering.
 */
function highlightSegments(
  text: string,
  query: string
): Array<{ text: string; isMatch: boolean }> {
  const q = query.trim()
  if (!q) return [{ text, isMatch: false }]
  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi')
  const parts = text.split(regex)
  return parts
    .filter((p) => p !== '')
    .map((part) => ({ text: part, isMatch: part.toLowerCase() === q.toLowerCase() }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranscriptPanel({
  videoId,
  transcriptData,
  isLoading,
  error,
  onFetch,
  onRetry,
  disabled = false,
}: TranscriptPanelProps) {
  const t = useTranslations('dashboard')
  const [copied, setCopied] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filter snippets by search query (preserving original index for keys/timestamps)
  const filteredSnippets = useMemo(() => {
    if (!transcriptData) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return transcriptData.snippets.map((snippet, i) => ({ snippet, originalIndex: i }))
    return transcriptData.snippets
      .map((snippet, i) => ({ snippet, originalIndex: i }))
      .filter(({ snippet }) => snippet.text.toLowerCase().includes(q))
  }, [transcriptData, searchQuery])

  const handleCopy = async () => {
    if (!transcriptData) return
    const text = transcriptData.snippets.map((s) => s.text).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = (type: 'txt' | 'srt') => {
    if (!transcriptData) return
    if (type === 'txt') {
      const text = transcriptData.snippets
        .map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)
        .join('\n')
      downloadFile(text, `transcript_${videoId}.txt`, 'text/plain')
    } else {
      const srt = generateSRT(transcriptData.snippets)
      downloadFile(srt, `transcript_${videoId}.srt`, 'text/srt')
    }
    setShowDownloadMenu(false)
  }

  const handleLanguageChange = (langCode: string) => {
    onFetch(langCode)
  }

  // ── Loading State ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-panel rounded-2xl p-5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 rounded bg-veil-3 animate-pulse" />
          <div className="w-32 h-4 rounded bg-veil-3 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-12 h-4 rounded bg-veil-2" />
              <div className="flex-1 h-4 rounded bg-veil-2" style={{ width: `${65 + ((i * 13) % 30)}%` }} />
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-4 text-center mt-4 font-medium">
          {t('transcriptLoading')}
        </p>
      </div>
    )
  }

  // ── Error State ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-panel rounded-2xl p-5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
        <div className="flex flex-col items-center py-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-tint flex items-center justify-center mb-3">
            <MaterialIcon name="description" size={20} className="text-red-400" />
          </div>
          <p className="text-sm font-semibold text-ink-2 mb-1">{t('transcriptError')}</p>
          <p className="text-xs text-ink-4 mb-4 max-w-[240px]">{error}</p>
          <button
            onClick={onRetry}
            disabled={disabled}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-500 
                       rounded-xl hover:bg-red-600 transition-colors duration-200 disabled:opacity-50"
          >
            <MaterialIcon name="refresh" size={12} />
            {t('transcriptRetry')}
          </button>
        </div>
      </div>
    )
  }

  // ── Empty / Not Fetched State ──────────────────────────────────────────
  if (!transcriptData) {
    return (
      <div className="bg-panel rounded-2xl p-5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
        <h3 className="text-xs font-bold text-ink-4 uppercase tracking-[0.15em] mb-3">
          {t('modeTranscript')}
        </h3>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-panel-sunken flex items-center justify-center mb-3 ring-1 ring-hairline">
            <MaterialIcon name="description" size={24} className="text-ink-4" />
          </div>
          <p className="text-sm font-semibold text-ink-2 mb-1">
            {t('transcriptReady')}
          </p>
          <p className="text-xs text-ink-4 max-w-[240px] mb-1">
            {t('transcriptReadySub')}
          </p>

        </div>
      </div>
    )
  }

  // ── Transcript Loaded ──────────────────────────────────────────────────
  return (
    <div className="bg-panel rounded-2xl p-5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-ink-4 uppercase tracking-[0.15em]">
          {t('modeTranscript')}
        </h3>
        <div className="flex items-center gap-1">
          {transcriptData.isGenerated && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-tint-warn bg-tint-warn px-2 py-0.5 rounded-full ring-1 ring-[var(--tint-warn)]">
              <MaterialIcon name="auto_awesome" size={10} />
              {t('transcriptGenerated')}
            </span>
          )}
        </div>
      </div>

      {/* Language selector + Actions */}
      <div className="flex items-center gap-2 mb-3">
        {/* Language dropdown */}
        {transcriptData.availableLanguages.length > 1 && (
          <div className="relative flex-1">
            <MaterialIcon name="language" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
            <select
              value={transcriptData.languageCode}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={disabled}
              className="w-full bg-panel-sunken border border-hairline rounded-lg pl-7 pr-3 py-2 text-xs font-medium text-ink-2 
                         focus:ring-2 focus:ring-[var(--brand-tint-strong)] focus:border-brand-tint disabled:opacity-40
                         transition-all duration-200 appearance-none cursor-pointer hover:border-hairline-strong"
            >
              {transcriptData.availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name} {lang.isGenerated ? `(${t('transcriptGenerated')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Copy button */}
        <button
          onClick={handleCopy}
          disabled={disabled}
          className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold rounded-lg transition-all duration-200
                     bg-panel-sunken text-ink-3 hover:bg-veil-2 hover:text-ink-2 ring-1 ring-hairline
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 text-tint-ok">
                <MaterialIcon name="check" size={12} />
                {t('transcriptCopied')}
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1">
                <MaterialIcon name="content_copy" size={12} />
                {t('transcriptCopy')}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Download button */}
        <div className="relative">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            disabled={disabled}
            className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold rounded-lg transition-all duration-200
                       bg-panel-sunken text-ink-3 hover:bg-veil-2 hover:text-ink-2 ring-1 ring-hairline
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MaterialIcon name="download" size={12} />
            {t('transcriptDownload')}
          </button>
          <AnimatePresence>
            {showDownloadMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full right-0 mt-1 bg-panel rounded-lg shadow-lg ring-1 ring-hairline p-1 z-20 min-w-[100px]"
              >
                <button
                  onClick={() => handleDownload('txt')}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-veil rounded-md transition-colors"
                >
                  .txt
                </button>
                <button
                  onClick={() => handleDownload('srt')}
                  className="w-full text-left px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-veil rounded-md transition-colors"
                >
                  .srt
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Snippet count */}
      <p className="text-[10px] text-ink-4 mb-2 font-medium">
        {transcriptData.snippets.length} {t('transcriptLines')} · {transcriptData.language}
      </p>

      {/* Search bar */}
      <div className="relative mb-2">
        <MaterialIcon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('transcriptSearchPlaceholder')}
          className="w-full bg-panel-sunken border border-hairline rounded-lg pl-8 pr-8 py-2 text-xs font-medium text-ink-2
                     placeholder:text-ink-4 focus:ring-2 focus:ring-[var(--brand-tint-strong)] focus:border-brand-tint
                     transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink-2 transition-colors"
            aria-label="Clear search"
          >
            <MaterialIcon name="close" size={14} />
          </button>
        )}
      </div>

      {/* Search results count */}
      {searchQuery.trim() && (
        <p className="text-[10px] text-ink-4 mb-2 font-medium">
          {filteredSnippets.length > 0
            ? t('transcriptSearchResults', { count: filteredSnippets.length })
            : t('transcriptSearchNoResults')}
        </p>
      )}

      {/* Scrollable transcript body */}
      <div className="max-h-[320px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
        {filteredSnippets.length === 0 && searchQuery.trim() ? (
          <div className="flex flex-col items-center py-8 text-center">
            <MaterialIcon name="search" size={20} className="text-ink-4 mb-2" />
            <p className="text-xs text-ink-4">{t('transcriptSearchNoResults')}</p>
          </div>
        ) : (
          filteredSnippets.map(({ snippet, originalIndex }) => {
            const isRtl = isRtlLanguage(transcriptData.languageCode)
            const segments = highlightSegments(snippet.text, searchQuery)
            return (
              <div
                key={originalIndex}
                className={`flex gap-3 py-1.5 px-2 rounded-lg hover:bg-veil transition-colors duration-150 group ${
                  isRtl ? 'flex-row-reverse' : ''
                }`}
              >
                <span
                  className={`text-[10px] font-mono font-semibold text-ink-4 pt-0.5 min-w-[36px] tabular-nums group-hover:text-red-400 transition-colors ${
                    isRtl ? 'text-left' : ''
                  }`}
                >
                  {formatTimestamp(snippet.start)}
                </span>
                <p
                  className={`text-sm text-ink-2 leading-relaxed flex-1 ${
                    isRtl ? 'text-right' : ''
                  }`}
                  dir={isRtl ? 'rtl' : 'ltr'}
                >
                  {segments.map((seg, si) =>
                    seg.isMatch ? (
                      <mark key={si} className="bg-yellow-200 text-ink rounded px-0.5">
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={si}>{seg.text}</span>
                    )
                  )}
                </p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
