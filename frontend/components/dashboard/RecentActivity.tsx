'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { useState } from 'react'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import Image from 'next/image'
import type { ActivityEntry } from '@/app/[locale]/dashboard/page'

interface RecentActivityProps {
  entries: ActivityEntry[]
  userId: string
  onReprocess?: (videoId: string) => void
}

/**
 * Returns a mode-specific icon component and color scheme based on the
 * download mode and format stored in the job row.
 */
function getModeVisuals(mode: string | null, format: string | null) {
  // Video + Audio
  if (mode === 'video' && format === 'video_audio') {
    return {
      iconName: 'movie',
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-500',
      badgeBg: 'bg-violet-50',
      badgeText: 'text-violet-600',
      badgeBorder: 'border-violet-100',
    }
  }

  // Video Only (no audio)
  if (mode === 'video' && format === 'video_only') {
    return {
      iconName: 'play_arrow',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-500',
      badgeBg: 'bg-blue-50',
      badgeText: 'text-blue-600',
      badgeBorder: 'border-blue-100',
    }
  }

  // Audio only
  if (mode === 'audio') {
    return {
      iconName: 'music_note',
      bgColor: 'bg-tint-ok',
      iconColor: 'text-tint-ok',
      badgeBg: 'bg-tint-ok',
      badgeText: 'text-tint-ok',
      badgeBorder: 'border-hairline',
    }
  }

  // Audio Only (from trim)
  if (mode === 'video' && format === 'audio_only') {
    return {
      iconName: 'music_note',
      bgColor: 'bg-tint-ok',
      iconColor: 'text-tint-ok',
      badgeBg: 'bg-tint-ok',
      badgeText: 'text-tint-ok',
      badgeBorder: 'border-hairline',
    }
  }

  // Thumbnail
  if (mode === 'thumbnail') {
    return {
      iconName: 'image',
      bgColor: 'bg-tint-warn',
      iconColor: 'text-tint-warn',
      badgeBg: 'bg-tint-warn',
      badgeText: 'text-tint-warn',
      badgeBorder: 'border-hairline',
    }
  }

  // Fallback — generic video
  return {
    iconName: 'video_file',
    bgColor: 'bg-panel-sunken',
    iconColor: 'text-ink-4',
    badgeBg: 'bg-panel-sunken',
    badgeText: 'text-ink-3',
    badgeBorder: 'border-hairline',
  }
}

/**
 * Returns a human-readable, translated label for the download mode/format.
 */
function getModeLabel(
  mode: string | null,
  format: string | null,
  t: ReturnType<typeof useTranslations>
): string {
  if (mode === 'video' && format === 'video_audio') {
    return t('activityVideoAudio')
  }
  if (mode === 'video' && format === 'video_only') {
    return t('activityVideoOnly')
  }
  if (mode === 'video' && format === 'audio_only') {
    return t('activityAudio')
  }
  if (mode === 'video') {
    return t('activityVideo')
  }
  if (mode === 'audio') {
    return t('activityAudio')
  }
  if (mode === 'thumbnail') {
    return t('activityThumbnail')
  }
  return t('activityDownload')
}

export function RecentActivity({ entries: initialEntries, userId: _userId, onReprocess }: RecentActivityProps) {
  const t = useTranslations('dashboard')
  const [entries, setEntries] = useState<ActivityEntry[]>(initialEntries)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    // No DB — just remove from local state
    setEntries((prev) => prev.filter((entry) => entry.id !== id))
    setDeletingId(null)
  }

  const handleDownload = (id: string) => {
    window.location.assign(`/api/files/download/${id}`)
  }

  if (entries.length === 0) {
    return (
      <div className="bg-panel rounded-2xl border border-hairline shadow-sm ring-1 ring-hairline px-6 py-5">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--panel-sunken)] to-[var(--veil-2)] flex items-center justify-center flex-shrink-0">
            <MaterialIcon name="download" size={18} className="text-ink-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-ink-2">{t('noActivity')}</h2>
            <p className="text-xs text-ink-4 mt-0.5">{t('noActivitySub')}</p>
          </div>
          <span className="hidden sm:inline-flex text-[11px] font-medium text-ink-4 bg-panel-sunken px-3 py-1.5 rounded-lg flex-shrink-0">
            {t('noActivityCta')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-panel rounded-2xl border border-hairline shadow-sm ring-1 ring-hairline p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-panel-sunken flex items-center justify-center">
          <MaterialIcon name="history" size={16} className="text-ink-4" />
        </div>
        <h2 className="text-base font-bold text-ink">
          {t('recentActivity')}
        </h2>
        <span className="text-xs font-medium text-ink-4 ml-auto">
          {entries.length} {entries.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => {
          const visuals = getModeVisuals(entry.mode, entry.format)
          const modeLabel = getModeLabel(entry.mode, entry.format, t)
          const { iconName } = visuals

          return (
            <div
              key={entry.id}
              className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-veil transition-all duration-200 group"
            >
              {/* Thumbnail with mode icon overlay */}
              <div className="relative flex-shrink-0">
                {entry.thumbnailUrl ? (
                  <div className="relative w-16 h-11 rounded-lg overflow-hidden ring-1 ring-hairline shadow-sm">
                    <Image
                      src={entry.thumbnailUrl}
                      alt={entry.videoTitle || t('emptyVideoHint')}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    {/* Mode icon badge - overlayed on thumbnail */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md ${visuals.bgColor} border ${visuals.badgeBorder} flex items-center justify-center shadow-sm`}>
                      <MaterialIcon name={iconName} size={10} className={visuals.iconColor} />
                    </div>
                  </div>
                ) : (
                  <div className={`w-16 h-11 rounded-lg ${visuals.bgColor} flex-shrink-0 flex items-center justify-center relative`}>
                    <MaterialIcon name={iconName} size={20} className={visuals.iconColor} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-ink text-sm truncate leading-snug">
                  {entry.videoTitle || modeLabel}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Mode badge */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${visuals.badgeText} ${visuals.badgeBg} border ${visuals.badgeBorder} px-1.5 py-0.5 rounded-md`}>
                    <MaterialIcon name={iconName} size={12} />
                    {modeLabel}
                  </span>
                  {entry.fileSizeBytes && (
                    <span className="flex items-center gap-1 text-[11px] text-ink-4">
                      <MaterialIcon name="hard_drive" size={12} />
                      {formatFileSize(entry.fileSizeBytes)}
                    </span>
                  )}
                  {entry.format && entry.mode === 'video' && entry.format.includes('trim') && (
                    <span className="flex items-center gap-1 text-[11px] text-orange-400">
                      <MaterialIcon name="content_cut" size={12} />
                      Trimmed
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-ink-4">
                    <MaterialIcon name="schedule" size={12} />
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                {/* Re-edit button — loads the video back into the editor */}
                {entry.videoId && entry.videoId !== 'pending' && entry.videoId !== 'unknown' && onReprocess && (
                  <button
                    onClick={() => onReprocess(entry.videoId!)}
                    className="w-8 h-8 flex items-center justify-center text-ink-4 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-all duration-150"
                    title={t('reEdit')}
                  >
                    <MaterialIcon name="edit" size={14} />
                  </button>
                )}

                {!entry.isExpired ? (
                  <button
                    onClick={() => handleDownload(entry.id)}
                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-brand hover:bg-brand-tint rounded-lg transition-all duration-150"
                    title={t('download')}
                  >
                    <MaterialIcon name="download" size={16} />
                  </button>
                ) : (
                  <span className="text-[10px] font-medium text-ink-4 bg-panel-sunken px-2 py-1 rounded-md">
                    {t('fileExpired')}
                  </span>
                )}

                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="w-8 h-8 flex items-center justify-center text-ink-4 hover:text-red-400 hover:bg-brand-tint rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={t('delete')}
                >
                  <MaterialIcon name="delete" size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}