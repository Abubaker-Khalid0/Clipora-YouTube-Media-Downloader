'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import type { QueueItem } from '@/hooks/useDownloadQueue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueuePanelProps {
  queue: QueueItem[]
  isProcessing: boolean
  onStart: () => void
  onRemove: (id: string) => void
  onClear: () => void
  onDownload: (id: string) => void
  onDownloadAll: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number | null): string {
  if (seconds == null) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function StatusIcon({ status }: { status: QueueItem['status'] }) {
  switch (status) {
    case 'waiting':
      return <MaterialIcon name="schedule" size={16} className="text-ink-4" />
    case 'processing':
      return <MaterialIcon name="progress_activity" size={16} className="text-blue-500 animate-spin" />
    case 'complete':
      return <MaterialIcon name="check_circle" size={16} className="text-tint-ok" />
    case 'failed':
      return <MaterialIcon name="cancel" size={16} className="text-brand" />
  }
}

function StageLabel({ item }: { item: QueueItem }) {
  if (item.status === 'waiting') return <span className="text-ink-4 text-xs">Waiting...</span>
  if (item.status === 'complete') return <span className="text-tint-ok text-xs font-medium">Done</span>
  if (item.status === 'failed') return <span className="text-brand text-xs">{item.error ?? 'Failed'}</span>
  if (item.status === 'processing') {
    const stageLabels: Record<string, string> = {
      initializing: 'Initializing...',
      extracting_info: 'Extracting info...',
      downloading: `Downloading ${item.progress}%`,
      merging: 'Merging...',
      trimming: 'Trimming...',
      finalizing: 'Finalizing...',
    }
    return (
      <span className="text-blue-600 text-xs font-medium">
        {stageLabels[item.stage ?? ''] ?? 'Processing...'}
      </span>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueuePanel({
  queue,
  isProcessing,
  onStart,
  onRemove,
  onClear,
  onDownload,
  onDownloadAll,
}: QueuePanelProps) {
  if (queue.length === 0) return null

  const waitingCount = queue.filter((q) => q.status === 'waiting').length
  const completedCount = queue.filter((q) => q.status === 'complete').length
  const failedCount = queue.filter((q) => q.status === 'failed').length
  const hasReadyFiles = completedCount > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-panel rounded-2xl border border-hairline shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-hairline bg-panel-sunken">
        <div className="flex items-center gap-2.5">
          <MaterialIcon name="format_list_numbered" size={16} className="text-ink-3" />
          <h3 className="text-sm font-semibold text-ink-2">
            Download Queue
          </h3>
          <span className="text-xs text-ink-4 bg-veil-2 px-2 py-0.5 rounded-full">
            {queue.length} item{queue.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasReadyFiles && (
            <button
              onClick={onDownloadAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
            >
              <MaterialIcon name="download" size={14} />
              Download All
            </button>
          )}
          <button
            onClick={onClear}
            className="text-xs text-ink-4 hover:text-brand transition-colors"
            title="Clear queue"
          >
            <MaterialIcon name="delete" size={14} />
          </button>
        </div>
      </div>

      {/* Queue items */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[var(--hairline)]">
        <AnimatePresence>
          {queue.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 px-5 py-3 hover:bg-veil transition-colors group"
            >
              {/* Status icon */}
              <StatusIcon status={item.status} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink-2 truncate">
                  {item.videoTitle}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <StageLabel item={item} />
                  {item.trimEnabled && item.trimStart != null && item.trimEnd != null && (
                    <span className="text-[10px] text-ink-4 bg-veil-2 px-1.5 py-0.5 rounded">
                      ✂ {formatTime(item.trimStart)} → {formatTime(item.trimEnd)}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar (processing) */}
              {item.status === 'processing' && (
                <div className="w-16 h-1.5 bg-veil-2 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500 rounded-full"
                    animate={{ width: `${item.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}

              {/* Actions */}
              {item.status === 'complete' && (
                <button
                  onClick={() => onDownload(item.id)}
                  className="text-blue-500 hover:text-blue-600 transition-colors"
                  title="Download"
                >
                  <MaterialIcon name="download" size={16} />
                </button>
              )}
              {item.status === 'waiting' && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="text-ink-4 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  <MaterialIcon name="close" size={16} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer with Start button */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-hairline bg-panel-sunken">
        <div className="text-xs text-ink-4">
          {isProcessing
            ? `Processing... (${completedCount}/${queue.length} done${failedCount > 0 ? `, ${failedCount} failed` : ''})`
            : `${waitingCount} waiting · ${completedCount} done${failedCount > 0 ? ` · ${failedCount} failed` : ''}`}
        </div>
        {!isProcessing && waitingCount > 0 && (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-lg hover:from-red-600 hover:to-red-700 transition-all active:scale-95 shadow-sm"
          >
            <MaterialIcon name="play_arrow" size={14} />
            Start Queue
          </button>
        )}
      </div>
    </motion.div>
  )
}
