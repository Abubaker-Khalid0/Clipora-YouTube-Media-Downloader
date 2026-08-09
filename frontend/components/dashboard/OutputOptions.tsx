'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatFileSize } from '@/lib/utils'
import type { OutputKind } from './OutputPicker'

/**
 * OutputOptions — settings for the chosen output, and nothing else.
 *
 * Replaces OutputControls, which took four booleans (hideModeTabs,
 * hideTrimToggle, showAudioOnly, includeTranscript) to contort one component
 * into three different shapes, and rendered its own mode tabs that duplicated
 * the feature menu above it.
 *
 * The `videoType` tri-state is gone too. "Audio only" was a video-mode option
 * that meant the same thing as the audio mode, so it is now simply
 * `output === 'audio'`, and video keeps one honest boolean: include the audio
 * track or not.
 */

interface OutputOptionsProps {
  output: OutputKind
  /** Video: keep the audio track. */
  includeAudio: boolean
  onIncludeAudioChange: (value: boolean) => void
  quality: string | null
  onQualityChange: (value: string) => void
  audioFormat: string | null
  onAudioFormatChange: (value: string) => void
  imageFormat: 'jpg' | 'png'
  onImageFormatChange: (value: 'jpg' | 'png') => void
  availableQualities: Array<{ label: string; formatId: string }>
  availableAudioFormats: Array<{ label: string; format: string }>
  trimEnabled: boolean
  onTrimEnabledChange: (value: boolean) => void
  /** Also save the transcript for the trimmed range. Trim only. */
  includeTranscript: boolean
  onIncludeTranscriptChange: (value: boolean) => void
  estimatedSizeBytes: number | null
  disabled?: boolean
}

const LABEL = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-4'

const SELECT =
  'w-full appearance-none cursor-pointer rounded-xl border border-hairline bg-panel-sunken px-4 py-3 text-sm font-medium text-ink-2 ' +
  'transition-colors duration-200 hover:border-hairline-strong ' +
  'focus:border-brand-tint focus:ring-2 focus:ring-[var(--brand-tint-strong)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/** Select with a chevron. `end-3` rather than `right-3` so RTL puts it left. */
function Select({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={SELECT}
        >
          {children}
        </select>
        <MaterialIcon
          name="expand_more"
          size={16}
          className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-4"
        />
      </div>
    </div>
  )
}

function Check({
  checked,
  onChange,
  disabled,
  icon,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled: boolean
  icon: string
  label: string
  hint?: string
}) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-lg px-1 py-2 transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-veil'
      }`}
    >
      <span
        className={`relative mt-px flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border-2 transition-colors duration-200 ${
          checked ? 'border-[#ea2a33] bg-[#ea2a33]' : 'border-hairline-strong'
        }`}
      >
        {checked && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <MaterialIcon name={icon} size={14} className="text-ink-4" />
          <span className="text-xs font-semibold text-ink-2">{label}</span>
        </span>
        {hint && <span className="mt-0.5 block text-[11px] leading-snug text-ink-4">{hint}</span>}
      </span>
    </label>
  )
}

export function OutputOptions({
  output,
  includeAudio,
  onIncludeAudioChange,
  quality,
  onQualityChange,
  audioFormat,
  onAudioFormatChange,
  imageFormat,
  onImageFormatChange,
  availableQualities,
  availableAudioFormats,
  trimEnabled,
  onTrimEnabledChange,
  includeTranscript,
  onIncludeTranscriptChange,
  estimatedSizeBytes,
  disabled = false,
}: OutputOptionsProps) {
  const t = useTranslations('dashboard')

  // Transcript and subtitle have no job settings; their panels own their UI.
  if (output === 'transcript' || output === 'subtitle') return null

  return (
    <div className="panel space-y-4 rounded-xl p-4">
      <h3 className="section-label">{t('outputSettings')}</h3>

      {output === 'video' && (
        <>
          <Select
            label={t('qualityLabel')}
            value={quality ?? ''}
            onChange={onQualityChange}
            disabled={disabled}
          >
            {availableQualities.map((q) => (
              <option key={q.formatId} value={q.formatId}>
                {q.label}
              </option>
            ))}
          </Select>

          <Check
            checked={includeAudio}
            onChange={onIncludeAudioChange}
            disabled={disabled}
            icon="volume_up"
            label={t('keepAudioTrack')}
            hint={includeAudio ? undefined : t('keepAudioTrackOffHint')}
          />
        </>
      )}

      {output === 'audio' && (
        <Select
          label={t('formatLabel')}
          value={audioFormat ?? ''}
          onChange={onAudioFormatChange}
          disabled={disabled}
        >
          {availableAudioFormats.map((f) => (
            <option key={f.format} value={f.format}>
              {f.label}
            </option>
          ))}
        </Select>
      )}

      {output === 'image' && (
        <Select
          label={t('thumbnailFormatLabel')}
          value={imageFormat}
          onChange={(v) => onImageFormatChange(v as 'jpg' | 'png')}
          disabled={disabled}
        >
          <option value="jpg">JPG</option>
          <option value="png">PNG</option>
        </Select>
      )}

      {/* Trim is a modifier, available on both media outputs. */}
      {(output === 'video' || output === 'audio') && (
        <div className="border-t border-hairline pt-1">
          <Check
            checked={trimEnabled}
            onChange={onTrimEnabledChange}
            disabled={disabled}
            icon="content_cut"
            label={t('enableTrim')}
          />

          {trimEnabled && (
            <Check
              checked={includeTranscript}
              onChange={onIncludeTranscriptChange}
              disabled={disabled}
              icon="description"
              label={t('includeTrimTranscript')}
            />
          )}
        </div>
      )}

      {estimatedSizeBytes !== null && !trimEnabled && (
        <p className="flex items-center gap-1.5 border-t border-hairline pt-3 text-[11px] font-medium text-ink-4">
          <MaterialIcon name="save" size={13} />
          {t('estimatedSize', { size: formatFileSize(estimatedSizeBytes) })}
        </p>
      )}
    </div>
  )
}
