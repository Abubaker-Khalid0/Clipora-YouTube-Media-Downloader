'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { motion, AnimatePresence } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubtitleLine {
  id: string
  text: string
  start: number
  end: number
}

export type SubtitleStyle =
  | 'classic'
  | 'tiktok'
  | 'modern-box'
  | 'cinematic'
  | 'outline'
  | 'bold-center'

export type SubtitleFont = 'english' | 'arabic'
export type SubtitleSize = 'small' | 'medium' | 'large'
export type SubtitlePosition = 'top' | 'center' | 'bottom'

export type SubtitleSource = 'youtube' | 'manual' | 'srt'

export interface SubtitleConfig {
  lines: SubtitleLine[]
  style: SubtitleStyle
  font: SubtitleFont
  size: SubtitleSize
  position: SubtitlePosition
  color: string
}

interface SubtitlePanelProps {
  videoId: string
  onConfigChange: (config: SubtitleConfig) => void
  config: SubtitleConfig
  disabled?: boolean
  onFetchCaptions: (lang?: string) => Promise<SubtitleLine[] | null>
  isLoadingCaptions?: boolean
  availableLanguages?: Array<{ code: string; name: string }>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLES: { id: SubtitleStyle; labelKey: string; icon: string }[] = [
  { id: 'classic', labelKey: 'subtitleStyleClassic', icon: 'text_fields' },
  { id: 'tiktok', labelKey: 'subtitleStyleTiktok', icon: 'phone_iphone' },
  { id: 'modern-box', labelKey: 'subtitleStyleModernBox', icon: 'crop_square' },
  { id: 'cinematic', labelKey: 'subtitleStyleCinematic', icon: 'movie' },
  { id: 'outline', labelKey: 'subtitleStyleOutline', icon: 'format_bold' },
  { id: 'bold-center', labelKey: 'subtitleStyleBoldCenter', icon: 'format_size' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
}

function parseTimeInput(value: string): number {
  const parts = value.split(':')
  if (parts.length === 2) {
    const [m, s] = parts
    return parseInt(m) * 60 + parseFloat(s)
  }
  return parseFloat(value) || 0
}

let lineIdCounter = 0
function generateId(): string {
  return `sub_${Date.now()}_${++lineIdCounter}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubtitlePanel({
  // videoId stays in the props contract but is not read here yet.
  onConfigChange,
  config,
  disabled = false,
  onFetchCaptions,
  isLoadingCaptions = false,
  availableLanguages = [],
}: SubtitlePanelProps) {
  const t = useTranslations('dashboard')
  const [source, setSource] = useState<SubtitleSource>('youtube')
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [captionLang, setCaptionLang] = useState('en')

  const labelClass = 'block text-[11px] font-bold text-ink-4 uppercase tracking-[0.12em] mb-2'

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleFetchYouTube = useCallback(async () => {
    const lines = await onFetchCaptions(captionLang)
    if (lines && lines.length > 0) {
      onConfigChange({ ...config, lines })
    }
  }, [onFetchCaptions, captionLang, config, onConfigChange])

  const handleAddLine = useCallback(() => {
    const lastLine = config.lines[config.lines.length - 1]
    const newStart = lastLine ? lastLine.end : 0
    const newLine: SubtitleLine = {
      id: generateId(),
      text: '',
      start: newStart,
      end: newStart + 3,
    }
    onConfigChange({ ...config, lines: [...config.lines, newLine] })
    setEditingLineId(newLine.id)
  }, [config, onConfigChange])

  const handleUpdateLine = useCallback((id: string, updates: Partial<SubtitleLine>) => {
    const newLines = config.lines.map((line) =>
      line.id === id ? { ...line, ...updates } : line
    )
    onConfigChange({ ...config, lines: newLines })
  }, [config, onConfigChange])

  const handleDeleteLine = useCallback((id: string) => {
    onConfigChange({ ...config, lines: config.lines.filter((l) => l.id !== id) })
  }, [config, onConfigChange])

  const handleSrtUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      const lines = parseSrt(content)
      if (lines.length > 0) {
        onConfigChange({ ...config, lines })
      }
    }
    reader.readAsText(file)
  }, [config, onConfigChange])

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="space-y-4">
      {/* Source selector */}
      <div className="bg-panel rounded-xl p-3.5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
        <label className={labelClass}>{t('subtitleSource')}</label>
        <div className="grid grid-cols-3 gap-1 bg-panel-sunken p-1 rounded-lg ring-1 ring-hairline">
          <SourceButton
            active={source === 'youtube'}
            icon="closed_caption"
            label="YouTube"
            onClick={() => setSource('youtube')}
            disabled={disabled}
          />
          <SourceButton
            active={source === 'manual'}
            icon="edit_note"
            label={t('subtitleManual')}
            onClick={() => setSource('manual')}
            disabled={disabled}
          />
          <SourceButton
            active={source === 'srt'}
            icon="upload_file"
            label="SRT"
            onClick={() => setSource('srt')}
            disabled={disabled}
          />
        </div>

        {/* YouTube source actions */}
        {source === 'youtube' && (
          <div className="mt-3 space-y-2">
            {availableLanguages.length > 1 && (
              <select
                value={captionLang}
                onChange={(e) => setCaptionLang(e.target.value)}
                disabled={disabled || isLoadingCaptions}
                className="w-full bg-panel-sunken border border-hairline rounded-lg px-3 py-2 text-xs font-medium text-ink-2 transition-all"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleFetchYouTube}
              disabled={disabled || isLoadingCaptions}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold
                         bg-veil-2 text-ink-2 hover:bg-veil-3 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingCaptions ? (
                <MaterialIcon name="progress_activity" size={14} className="animate-spin" />
              ) : (
                <MaterialIcon name="download" size={14} />
              )}
              {isLoadingCaptions ? t('subtitleFetching') : t('subtitleFetchYT')}
            </button>
          </div>
        )}

        {/* SRT upload */}
        {source === 'srt' && (
          <div className="mt-3">
            <label className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold
                              border-2 border-dashed border-hairline text-ink-3
                              hover:border-brand-tint hover:text-brand hover:bg-brand-tint
                              transition-all cursor-pointer">
              <MaterialIcon name="upload_file" size={16} />
              {t('subtitleUploadSrt')}
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleSrtUpload}
                className="hidden"
                disabled={disabled}
              />
            </label>
          </div>
        )}
      </div>

      {/* Subtitle lines editor */}
      {(config.lines.length > 0 || source === 'manual') && (
        <div className="bg-panel rounded-xl p-3.5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
          <div className="flex items-center justify-between mb-3">
            <label className={labelClass + ' mb-0'}>{t('subtitleLines')}</label>
            <span className="text-[10px] text-ink-4 font-medium">
              {config.lines.length} {t('subtitleLinesCount')}
            </span>
          </div>

          <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            <AnimatePresence>
              {config.lines.map((line, index) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group relative bg-panel-sunken rounded-lg p-2.5 ring-1 ring-hairline hover:ring-[var(--hairline-strong)] transition-all"
                >
                  {editingLineId === line.id ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={line.text}
                        onChange={(e) => handleUpdateLine(line.id, { text: e.target.value })}
                        placeholder={t('subtitleTextPlaceholder')}
                        className="w-full bg-panel border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:ring-2 focus:ring-[var(--brand-tint-strong)] focus:border-brand-tint outline-none"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={formatTime(line.start)}
                          onChange={(e) => handleUpdateLine(line.id, { start: parseTimeInput(e.target.value) })}
                          className="flex-1 bg-panel border border-hairline rounded-md px-2 py-1.5 text-[11px] font-mono text-ink-2 text-center"
                          placeholder="0:00.00"
                        />
                        <MaterialIcon name="arrow_forward" size={12} className="text-ink-4" />
                        <input
                          type="text"
                          value={formatTime(line.end)}
                          onChange={(e) => handleUpdateLine(line.id, { end: parseTimeInput(e.target.value) })}
                          className="flex-1 bg-panel border border-hairline rounded-md px-2 py-1.5 text-[11px] font-mono text-ink-2 text-center"
                          placeholder="0:03.00"
                        />
                        <button
                          onClick={() => setEditingLineId(null)}
                          className="p-1 text-tint-ok hover:bg-tint-ok rounded transition-colors"
                        >
                          <MaterialIcon name="check" size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-ink-4 flex-shrink-0 w-8 text-center">
                        {index + 1}
                      </span>
                      <span className="text-[10px] font-mono text-ink-4 flex-shrink-0">
                        {formatTime(line.start)}
                      </span>
                      <p className="flex-1 text-xs text-ink-2 font-medium truncate">
                        {line.text || <span className="italic text-ink-4">{t('subtitleEmpty')}</span>}
                      </p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingLineId(line.id)}
                          className="p-1 text-ink-4 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                          disabled={disabled}
                        >
                          <MaterialIcon name="edit" size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteLine(line.id)}
                          className="p-1 text-ink-4 hover:text-brand hover:bg-brand-tint rounded transition-colors"
                          disabled={disabled}
                        >
                          <MaterialIcon name="close" size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add line button */}
          <button
            onClick={handleAddLine}
            disabled={disabled}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
                       text-xs font-semibold text-ink-4 hover:text-brand
                       border border-dashed border-hairline hover:border-brand-tint hover:bg-brand-tint
                       transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MaterialIcon name="add" size={14} />
            {t('subtitleAddLine')}
          </button>
        </div>
      )}

      {/* Style & Font settings */}
      <div className="bg-panel rounded-xl p-3.5 shadow-lg shadow-[var(--shadow-tint)] ring-1 ring-hairline">
        <label className={labelClass}>{t('subtitleStyleTitle')}</label>

        {/* Style grid */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onConfigChange({ ...config, style: style.id })}
              disabled={disabled}
              className={`
                flex items-center gap-1.5 py-2 px-2.5 rounded-lg
                transition-all duration-200
                ${config.style === style.id
                  ? 'bg-brand-tint ring-2 ring-[var(--brand-tint-strong)]'
                  : 'bg-panel-sunken ring-1 ring-hairline hover:bg-veil-2'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <MaterialIcon
                name={style.icon}
                size={14}
                className={config.style === style.id ? 'text-brand' : 'text-ink-2'}
              />
              <span className={`text-[10px] font-bold leading-tight ${
                config.style === style.id ? 'text-brand' : 'text-ink-2'
              }`}>
                {t(style.labelKey)}
              </span>
            </button>
          ))}
        </div>

        {/* Font selector */}
        <div className="space-y-2.5">
          <div>
            <label className={labelClass}>{t('subtitleFont')}</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => onConfigChange({ ...config, font: 'english' })}
                disabled={disabled}
                className={`py-2 px-3 rounded-lg text-[11px] font-bold transition-all
                  ${config.font === 'english'
                    ? 'bg-brand-tint ring-2 ring-[var(--brand-tint-strong)] text-brand'
                    : 'bg-panel-sunken ring-1 ring-hairline text-ink-2 hover:bg-veil-2'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                English
              </button>
              <button
                onClick={() => onConfigChange({ ...config, font: 'arabic' })}
                disabled={disabled}
                className={`py-2 px-3 rounded-lg text-[11px] font-bold transition-all
                  ${config.font === 'arabic'
                    ? 'bg-brand-tint ring-2 ring-[var(--brand-tint-strong)] text-brand'
                    : 'bg-panel-sunken ring-1 ring-hairline text-ink-2 hover:bg-veil-2'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Ø¹Ø±Ø¨ÙŠ
              </button>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className={labelClass}>{t('subtitleSize')}</label>
            <div className="grid grid-cols-3 gap-1">
              {(['small', 'medium', 'large'] as SubtitleSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => onConfigChange({ ...config, size })}
                  disabled={disabled}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                    ${config.size === size
                      ? 'bg-brand-tint ring-2 ring-[var(--brand-tint-strong)] text-brand'
                      : 'bg-panel-sunken ring-1 ring-hairline text-ink-2 hover:bg-veil-2'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t(`subtitleSize${size.charAt(0).toUpperCase() + size.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Position */}
          <div>
            <label className={labelClass}>{t('subtitlePosition')}</label>
            <div className="grid grid-cols-3 gap-1">
              {(['top', 'center', 'bottom'] as SubtitlePosition[]).map((pos) => (
                <button
                  key={pos}
                  onClick={() => onConfigChange({ ...config, position: pos })}
                  disabled={disabled}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all
                    ${config.position === pos
                      ? 'bg-brand-tint ring-2 ring-[var(--brand-tint-strong)] text-brand'
                      : 'bg-panel-sunken ring-1 ring-hairline text-ink-2 hover:bg-veil-2'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {t(`subtitlePos${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceButton({
  active,
  icon,
  label,
  onClick,
  disabled,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center gap-1.5 py-2 px-2 rounded-md
        transition-all duration-200
        ${active
          ? 'bg-panel shadow-sm ring-1 ring-[var(--brand-tint-strong)]'
          : 'hover:bg-veil'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <MaterialIcon
        name={icon}
        size={14}
        className={active ? 'text-brand' : 'text-ink-2'}
      />
      <span className={`text-[10px] font-bold leading-tight ${
        active ? 'text-brand' : 'text-ink-2'
      }`}>
        {label}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// SRT Parser
// ---------------------------------------------------------------------------

function parseSrt(content: string): SubtitleLine[] {
  const lines: SubtitleLine[] = []
  const blocks = content.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const parts = block.trim().split('\n')
    if (parts.length < 3) continue

    const timeLine = parts[1]
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    )
    if (!timeMatch) continue

    const start =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000

    const end =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000

    const text = parts.slice(2).join(' ').replace(/<[^>]+>/g, '')

    lines.push({ id: generateId(), text, start, end })
  }

  return lines
}
