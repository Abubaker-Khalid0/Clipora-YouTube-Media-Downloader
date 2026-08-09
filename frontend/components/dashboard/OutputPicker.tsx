'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * OutputPicker — the single question the dashboard asks first: what do you want
 * out of this video?
 *
 * Replaces FeatureMenu, which listed five sibling tabs (download, trim,
 * subtitle, thumbnail, transcript) and mixed two different kinds of thing:
 * outputs (a file type) and modifiers (trim). Trim is now a checkbox inside the
 * video and audio options, where it belongs, so the top level only ever asks
 * about the artefact you are trying to produce.
 */

/** What the user wants out. Distinct from the backend's job mode. */
export type OutputKind = 'video' | 'audio' | 'image' | 'transcript' | 'subtitle'

interface OutputOption {
  id: OutputKind
  icon: string
  labelKey: string
  /** Renders disabled with a "soon" badge. */
  soon?: boolean
}

export const OUTPUTS: OutputOption[] = [
  { id: 'video', icon: 'movie', labelKey: 'modeVideo' },
  { id: 'audio', icon: 'music_note', labelKey: 'modeAudio' },
  { id: 'image', icon: 'image', labelKey: 'modeThumbnail' },
  { id: 'transcript', icon: 'description', labelKey: 'modeTranscript' },
  // Backend support does not exist yet: there is no subtitle field on the job
  // contract and no burn-in step in the processor.
  { id: 'subtitle', icon: 'closed_caption', labelKey: 'featureSubtitle', soon: true },
]

interface OutputPickerProps {
  value: OutputKind
  onChange: (output: OutputKind) => void
  disabled?: boolean
}

export function OutputPicker({ value, onChange, disabled = false }: OutputPickerProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="panel rounded-xl p-3">
      <h2 className="section-label mb-2.5 px-0.5">{t('outputQuestion')}</h2>

      <div role="radiogroup" aria-label={t('outputQuestion')} className="grid grid-cols-2 gap-1.5">
        {OUTPUTS.map((option) => {
          const active = option.id === value
          const isDisabled = disabled || option.soon

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => onChange(option.id)}
              title={option.soon ? t('comingSoon') : undefined}
              className={`relative flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-start transition-colors duration-200
                ${
                  active
                    ? 'bg-brand-tint ring-1 ring-[var(--brand-tint-strong)]'
                    : isDisabled
                      ? 'opacity-45'
                      : 'hover:bg-veil-2'
                }
                ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <MaterialIcon
                name={option.icon}
                size={17}
                className={active ? 'text-brand' : 'text-ink-4'}
              />
              <span
                className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${
                  active ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {t(option.labelKey)}
              </span>

              {option.soon && (
                <span className="flex-shrink-0 rounded-full bg-veil-3 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-4">
                  {t('comingSoon')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
