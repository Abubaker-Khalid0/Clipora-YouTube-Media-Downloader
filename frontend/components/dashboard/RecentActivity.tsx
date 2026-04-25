'use client'

import { useTranslations } from 'next-intl'
import {
  History,
  Download,
  Trash2,
  Clock,
  HardDrive,
  FileVideo,
  Play,
  Music,
  ImageIcon,
  Film,
  Scissors,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatFileSize, formatRelativeTime } from '@/lib/utils'
import Image from 'next/image'
import type { ActivityEntry } from '@/app/[locale]/dashboard/page'

interface RecentActivityProps {
  entries: ActivityEntry[]
  userId: string
}

/**
 * Returns a mode-specific icon component and color scheme based on the
 * download mode and format stored in the job row.
 */
function getModeVisuals(mode: string | null, format: string | null) {
  // Video + Audio
  if (mode === 'video' && format === 'video_audio') {
    return {
      Icon: Film,
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
      Icon: Play,
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
      Icon: Music,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-600',
      badgeBorder: 'border-emerald-100',
    }
  }

  // Audio Only (from trim)
  if (mode === 'video' && format === 'audio_only') {
    return {
      Icon: Music,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-600',
      badgeBorder: 'border-emerald-100',
    }
  }

  // Thumbnail
  if (mode === 'thumbnail') {
    return {
      Icon: ImageIcon,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-500',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-600',
      badgeBorder: 'border-amber-100',
    }
  }

  // Fallback — generic video
  return {
    Icon: FileVideo,
    bgColor: 'bg-slate-50',
    iconColor: 'text-slate-400',
    badgeBg: 'bg-slate-50',
    badgeText: 'text-slate-500',
    badgeBorder: 'border-slate-100',
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

export function RecentActivity({ entries: initialEntries, userId }: RecentActivityProps) {
  const t = useTranslations('dashboard')
  const [entries, setEntries] = useState<ActivityEntry[]>(initialEntries)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const supabase = createClient()

      // Filter by both id AND user_id — defense-in-depth against misconfigured RLS.
      // Without user_id, a client with a known job UUID could delete any row
      // if RLS policies are ever weakened or misconfigured.
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) {
        console.error('[RecentActivity:handleDelete] failed:', error)
        return
      }

      setEntries((prev) => prev.filter((entry) => entry.id !== id))
    } catch (err) {
      console.error('[RecentActivity:handleDelete] unexpected error:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = (id: string) => {
    window.location.href = `/api/files/download/${id}`
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm ring-1 ring-slate-50 p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
            <History className="w-4 h-4 text-slate-300" />
          </div>
          <h2 className="text-base font-bold text-slate-800">
            {t('recentActivity')}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 border border-slate-100 rounded-xl bg-slate-50/30">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
            <History className="w-6 h-6 text-slate-200" />
          </div>
          <p className="text-slate-500 font-semibold text-sm">{t('noActivity')}</p>
          <p className="text-slate-300 text-xs mt-1.5">{t('noActivitySub')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm ring-1 ring-slate-50 p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
          <History className="w-4 h-4 text-slate-400" />
        </div>
        <h2 className="text-base font-bold text-slate-800">
          {t('recentActivity')}
        </h2>
        <span className="text-xs font-medium text-slate-300 ml-auto">
          {entries.length} {entries.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-1">
        {entries.map((entry) => {
          const visuals = getModeVisuals(entry.mode, entry.format)
          const modeLabel = getModeLabel(entry.mode, entry.format, t)
          const { Icon } = visuals

          return (
            <div
              key={entry.id}
              className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-slate-50/80 transition-all duration-200 group"
            >
              {/* Thumbnail with mode icon overlay */}
              <div className="relative flex-shrink-0">
                {entry.thumbnailUrl ? (
                  <div className="relative w-16 h-11 rounded-lg overflow-hidden ring-1 ring-slate-200/50 shadow-sm">
                    <Image
                      src={entry.thumbnailUrl}
                      alt={entry.videoTitle || t('emptyVideoHint')}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    {/* Mode icon badge - overlayed on thumbnail */}
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-md ${visuals.bgColor} border ${visuals.badgeBorder} flex items-center justify-center shadow-sm`}>
                      <Icon className={`w-2.5 h-2.5 ${visuals.iconColor}`} />
                    </div>
                  </div>
                ) : (
                  <div className={`w-16 h-11 rounded-lg ${visuals.bgColor} flex-shrink-0 flex items-center justify-center relative`}>
                    <Icon className={`w-5 h-5 ${visuals.iconColor}`} />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 text-sm truncate leading-snug">
                  {entry.videoTitle || modeLabel}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                  {/* Mode badge */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${visuals.badgeText} ${visuals.badgeBg} border ${visuals.badgeBorder} px-1.5 py-0.5 rounded-md`}>
                    <Icon className="w-3 h-3" />
                    {modeLabel}
                  </span>
                  {entry.fileSizeBytes && (
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <HardDrive className="w-3 h-3" />
                      {formatFileSize(entry.fileSizeBytes)}
                    </span>
                  )}
                  {entry.format && entry.mode === 'video' && entry.format.includes('trim') && (
                    <span className="flex items-center gap-1 text-[11px] text-orange-400">
                      <Scissors className="w-3 h-3" />
                      Trimmed
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-slate-300">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(entry.createdAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                {!entry.isExpired ? (
                  <button
                    onClick={() => handleDownload(entry.id)}
                    className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
                    title={t('download')}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[10px] font-medium text-slate-300 bg-slate-50 px-2 py-1 rounded-md">
                    {t('fileExpired')}
                  </span>
                )}

                <button
                  onClick={() => handleDelete(entry.id)}
                  disabled={deletingId === entry.id}
                  className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50/50 rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={t('delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}