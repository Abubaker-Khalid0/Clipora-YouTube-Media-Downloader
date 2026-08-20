'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useDownloadQueue, type UseDownloadQueueReturn } from '@/hooks/useDownloadQueue'

/**
 * QueueProvider — owns the download queue for the whole dashboard shell.
 *
 * The queue used to live inside DashboardClient, which meant only DashboardClient
 * could see it: the panel had to render in that component's own subtree, and it
 * ended up stacked under the fold next to "Recent activity" — a pending batch
 * grouped with a finished-downloads log. Lifting the hook one level up lets the
 * navbar own the trigger (with a live counter) and the drawer render as an
 * overlay, so adding an item gives feedback where the user is looking.
 *
 * Deliberately *not* moved into the root layout. Keeping it on the dashboard
 * segment means an in-flight queue is still torn down when the user navigates
 * away, exactly as before — surviving navigation needs persistence plus job
 * re-attachment, which is a separate piece of work, not a side effect of a
 * layout change.
 */

interface QueueContextValue extends UseDownloadQueueReturn {
  /** Whether the queue drawer is visible. */
  isOpen: boolean
  openQueue: () => void
  closeQueue: () => void
}

const QueueContext = createContext<QueueContextValue | null>(null)

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext)
  if (!ctx) {
    throw new Error('useQueue() must be called inside <QueueProvider>')
  }
  return ctx
}

export function QueueProvider({ children }: { children: ReactNode }) {
  const controller = useDownloadQueue()
  const [isOpen, setIsOpen] = useState(false)

  const openQueue = useCallback(() => setIsOpen(true), [])
  const closeQueue = useCallback(() => setIsOpen(false), [])

  const value = useMemo<QueueContextValue>(
    () => ({ ...controller, isOpen, openQueue, closeQueue }),
    [controller, isOpen, openQueue, closeQueue]
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}
