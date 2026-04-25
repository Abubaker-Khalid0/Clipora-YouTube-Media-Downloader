'use client'

import { useTranslations } from 'next-intl'
import { Video, Music, ImageIcon, HardDrive, Clock, ChevronDown, Scissors, VolumeX } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DownloadMode = 'video' | 'audio' | 'thumbnail'
type VideoType = 'video_audio' | 'video_only' | 'audio_only'
type ThumbnailFormat = 'jpg' | 'png'

interface QualityOption {
  label: string
  formatId: string
}

interface AudioFormat {
  label: string
  format: string
}

interface OutputControlsProps {
  mode: DownloadMode
  onModeChange: (mode: DownloadMode) => void
  videoType: VideoType
  onVideoTypeChange: (vt: VideoType) => void
  thumbnailFormat: ThumbnailFormat
  onThumbnailFormatChange: (fmt: ThumbnailFormat) => void
  selectedQuality: string | null
  onQualityChange: (quality: string) => void
  selectedFormat: string | null
  onFormatChange: (format: string) => void
  availableQualities: QualityOption[]
  availableAudioFormats: AudioFormat[]
  estimatedSizeBytes: number | null
  estimatedTimeSeconds: number | null
  trimEnabled: boolean
  onTrimEnabledChange: (enabled: boolean) => void
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSize(bytes: number | null): string {
  if (!bytes) return '—'
  const gb = bytes / (1024 * 1024 * 1024)
  const mb = bytes / (1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(0)} MB`
}

function formatTime(seconds: number | null): string {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ModeTabProps {
  label: string
  icon: React.ReactNode
  value: DownloadMode
  current: DownloadMode
  disabled: boolean
  onClick: (mode: DownloadMode) => void
}

function ModeTab({ label, icon, value, current, disabled, onClick }: ModeTabProps) {
  const active = value === current
  return (
    <button
      onClick={() => onClick(value)}
      disabled={disabled}
      className={`
        flex-1 py-2.5 px-3 text-xs font-bold rounded-xl
        transition-all duration-200 text-center
        flex items-center justify-center gap-1.5
        ${active
          ? 'bg-white shadow-md shadow-slate-200/50 text-slate-900 ring-1 ring-slate-200/50'
          : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {icon}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutputControls({
  mode,
  onModeChange,
  videoType,
  onVideoTypeChange,
  thumbnailFormat,
  onThumbnailFormatChange,
  selectedQuality,
  onQualityChange,
  selectedFormat,
  onFormatChange,
  availableQualities,
  availableAudioFormats,
  estimatedSizeBytes,
  estimatedTimeSeconds,
  trimEnabled,
  onTrimEnabledChange,
  disabled = false,
}: OutputControlsProps) {
  const t = useTranslations('dashboard')

  const selectClass =
    'w-full bg-slate-50/80 border border-slate-200/80 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 ' +
    'focus:ring-2 focus:ring-red-100 focus:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed ' +
    'transition-all duration-200 appearance-none cursor-pointer hover:border-slate-300'

  const labelClass =
    'block text-[11px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2'

  return (
    <div className="bg-white rounded-2xl p-5 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100">

      {/* Section title */}
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.15em] mb-3">
        {t('outputSettings') || 'Output Settings'}
      </h3>

      {/* Mode tabs */}
      <div className="bg-slate-50 p-1 rounded-xl flex mb-5 ring-1 ring-slate-100">
        <ModeTab 
          label={t('modeVideo')} 
          icon={<Video className="w-3.5 h-3.5" />}
          value="video" current={mode} disabled={disabled} onClick={onModeChange} 
        />
        <ModeTab 
          label={t('modeAudio')} 
          icon={<Music className="w-3.5 h-3.5" />}
          value="audio" current={mode} disabled={disabled} onClick={onModeChange} 
        />
        <ModeTab 
          label={t('modeThumbnail')} 
          icon={<ImageIcon className="w-3.5 h-3.5" />}
          value="thumbnail" current={mode} disabled={disabled} onClick={onModeChange} 
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-100 mb-5" />

      {/* ── Video mode ──────────────────────────────────────────────────── */}
      {mode === 'video' && (
        <div className="space-y-4">
          {/* Quality — hidden when audio_only since there's no video resolution to pick */}
          {videoType !== 'audio_only' && (
            <div>
              <label className={labelClass}>{t('qualityLabel')}</label>
              <div className="relative">
                <select
                  value={selectedQuality || ''}
                  onChange={(e) => onQualityChange(e.target.value)}
                  disabled={disabled}
                  className={selectClass}
                >
                  {availableQualities.map((q) => (
                    <option key={q.formatId} value={q.formatId}>
                      {q.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Output Type — shows 3 pill options when trim is on, 2-option dropdown when off */}
          {trimEnabled ? (
            <div>
              <label className={labelClass}>{t('trimOutputLabel')}</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl ring-1 ring-slate-100">
                {/* Video + Audio */}
                <button
                  onClick={() => onVideoTypeChange('video_audio')}
                  disabled={disabled}
                  className={`
                    flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-center
                    transition-all duration-200
                    ${videoType === 'video_audio'
                      ? 'bg-white shadow-md shadow-violet-200/40 ring-1 ring-violet-200/60'
                      : 'hover:bg-white/50'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    videoType === 'video_audio'
                      ? 'bg-violet-100 text-violet-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Video className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-[10px] font-bold leading-tight transition-colors duration-200 ${
                    videoType === 'video_audio' ? 'text-violet-700' : 'text-slate-400'
                  }`}>
                    {t('videoTypeVideoAudio')}
                  </span>
                </button>

                {/* Video Only */}
                <button
                  onClick={() => onVideoTypeChange('video_only')}
                  disabled={disabled}
                  className={`
                    flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-center
                    transition-all duration-200
                    ${videoType === 'video_only'
                      ? 'bg-white shadow-md shadow-blue-200/40 ring-1 ring-blue-200/60'
                      : 'hover:bg-white/50'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    videoType === 'video_only'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <VolumeX className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-[10px] font-bold leading-tight transition-colors duration-200 ${
                    videoType === 'video_only' ? 'text-blue-700' : 'text-slate-400'
                  }`}>
                    {t('videoTypeVideoOnly')}
                  </span>
                </button>

                {/* Audio Only */}
                <button
                  onClick={() => onVideoTypeChange('audio_only')}
                  disabled={disabled}
                  className={`
                    flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg text-center
                    transition-all duration-200
                    ${videoType === 'audio_only'
                      ? 'bg-white shadow-md shadow-emerald-200/40 ring-1 ring-emerald-200/60'
                      : 'hover:bg-white/50'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    videoType === 'audio_only'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Music className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-[10px] font-bold leading-tight transition-colors duration-200 ${
                    videoType === 'audio_only' ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    {t('trimOutputAudioOnly')}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className={labelClass}>{t('videoTypeLabel')}</label>
              <div className="relative">
                <select
                  value={videoType}
                  onChange={(e) => onVideoTypeChange(e.target.value as VideoType)}
                  disabled={disabled}
                  className={selectClass}
                >
                  <option value="video_audio">{t('videoTypeVideoAudio')}</option>
                  <option value="video_only">{t('videoTypeVideoOnly')}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Enable Trim toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer group px-1 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200">
              <div className={`relative w-[18px] h-[18px] border-2 rounded flex items-center justify-center transition-all duration-200 ${
                trimEnabled
                  ? 'bg-red-500 border-red-500 shadow-sm shadow-red-500/20'
                  : 'border-slate-300 group-hover:border-slate-400'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {trimEnabled && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <input
                  type="checkbox"
                  checked={trimEnabled}
                  onChange={(e) => onTrimEnabledChange(e.target.checked)}
                  disabled={disabled}
                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
              </div>
              <Scissors className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">
                {t('enableTrim')}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* ── Audio mode ──────────────────────────────────────────────────── */}
      {mode === 'audio' && (
        <div>
          <label className={labelClass}>{t('formatLabel')}</label>
          <div className="relative">
            <select
              value={selectedFormat || ''}
              onChange={(e) => onFormatChange(e.target.value)}
              disabled={disabled}
              className={selectClass}
            >
              {availableAudioFormats.map((f) => (
                <option key={f.format} value={f.format}>
                  {f.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── Thumbnail mode ───────────────────────────────────────────────── */}
      {mode === 'thumbnail' && (
        <div>
          <label className={labelClass}>{t('thumbnailFormatLabel')}</label>
          <div className="relative">
            <select
              value={thumbnailFormat}
              onChange={(e) => onThumbnailFormatChange(e.target.value as ThumbnailFormat)}
              disabled={disabled}
              className={selectClass}
            >
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── Estimated info ───────────────────────────────────────────────── */}
      <div className="mt-5">
        <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <HardDrive className="w-3 h-3" />
              {t('estimatedSize', { size: '' }).replace(': ', '').trim() || 'Est. Size'}
            </span>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              {formatSize(estimatedSizeBytes)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {t('estimatedTime', { time: '' }).replace(': ', '').trim() || 'Est. Time'}
            </span>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              {formatTime(estimatedTimeSeconds)}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}