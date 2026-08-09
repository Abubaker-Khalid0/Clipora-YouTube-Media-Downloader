'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueueItemStatus = 'waiting' | 'processing' | 'complete' | 'failed'

export interface QueueItem {
  id: string
  url: string
  videoId: string
  videoTitle: string
  thumbnailUrl: string
  mode: 'video' | 'audio' | 'thumbnail'
  videoType: 'video_audio' | 'video_only' | 'audio_only'
  quality: string | null
  trimEnabled: boolean
  trimStart: number | null
  trimEnd: number | null
  thumbnailFormat: 'jpg' | 'png'
  // Runtime state
  status: QueueItemStatus
  jobId: string | null
  fileId: string | null
  progress: number
  stage: string | null
  error: string | null
}

export interface UseDownloadQueueReturn {
  queue: QueueItem[]
  isProcessing: boolean
  addToQueue: (item: Omit<QueueItem, 'id' | 'status' | 'jobId' | 'fileId' | 'progress' | 'stage' | 'error'>) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
  startQueue: () => void
  downloadFile: (id: string) => void
  downloadAllReady: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDownloadQueue(): UseDownloadQueueReturn {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const processingRef = useRef(false)
  const queueRef = useRef<QueueItem[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  // Holds the latest processNext so the worker can recurse without referencing
  // the callback before it is declared (keeps the dependency graph clean).
  const processNextRef = useRef<() => void>(() => {})

  // Keep ref in sync with state
  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const sendNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)))
  }, [])

  // Process next waiting item
  const processNext = useCallback(async () => {
    const currentQueue = queueRef.current
    const nextItem = currentQueue.find((q) => q.status === 'waiting')

    if (!nextItem) {
      // Queue is done
      setIsProcessing(false)
      processingRef.current = false

      const completed = currentQueue.filter((q) => q.status === 'complete').length
      const failed = currentQueue.filter((q) => q.status === 'failed').length
      if (completed > 0 || failed > 0) {
        const msg = failed > 0
          ? `✅ ${completed} completed, ❌ ${failed} failed`
          : `✅ All ${completed} downloads completed!`
        sendNotification('Clipora — Queue Complete', msg)
      }
      return
    }

    // Mark as processing
    updateItem(nextItem.id, { status: 'processing', progress: 0 })

    try {
      // Create the job
      const body: Record<string, unknown> = {
        url: nextItem.url,
        mode: nextItem.mode,
        quality: nextItem.quality,
        trimEnabled: nextItem.trimEnabled,
        trimStart: nextItem.trimEnabled ? nextItem.trimStart : null,
        trimEnd: nextItem.trimEnabled ? nextItem.trimEnd : null,
        videoTitle: nextItem.videoTitle,
        thumbnailUrl: nextItem.thumbnailUrl,
      }

      if (nextItem.mode === 'video') {
        body.videoType = nextItem.videoType
      }
      if (nextItem.mode === 'thumbnail') {
        body.thumbnailFormat = nextItem.thumbnailFormat
      }

      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorMsg = result.error ?? 'Failed to start download'
        updateItem(nextItem.id, { status: 'failed', error: errorMsg })
        // Continue to next
        setTimeout(() => processNextRef.current(), 1500)
        return
      }

      const jobId = result.data.jobId as string
      updateItem(nextItem.id, { jobId })

      // Monitor via SSE
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/jobs/${jobId}/stream`)
        eventSourceRef.current = es

        es.onmessage = (event: MessageEvent<string>) => {
          try {
            const payload = JSON.parse(event.data) as {
              stage: string
              percent?: number
              file_id?: string
              message?: string
            }

            updateItem(nextItem.id, {
              stage: payload.stage,
              progress: payload.percent ?? undefined,
            })

            if (payload.stage === 'complete') {
              es.close()
              updateItem(nextItem.id, {
                status: 'complete',
                fileId: payload.file_id ?? jobId,
                progress: 100,
              })
              resolve()
            }

            if (payload.stage === 'error') {
              es.close()
              updateItem(nextItem.id, {
                status: 'failed',
                error: payload.message ?? 'Download failed',
              })
              resolve()
            }
          } catch {
            // Malformed event — ignore
          }
        }

        es.onerror = () => {
          es.close()
          updateItem(nextItem.id, {
            status: 'failed',
            error: 'Connection lost',
          })
          resolve()
        }
      })

      // Short delay then process next
      setTimeout(() => processNextRef.current(), 1500)
    } catch (err) {
      updateItem(nextItem.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Network error',
      })
      setTimeout(() => processNextRef.current(), 1500)
    }
  }, [sendNotification, updateItem])

  // Keep the recursion ref pointed at the latest processNext.
  useEffect(() => {
    processNextRef.current = processNext
  }, [processNext])

  const addToQueue = useCallback(
    (item: Omit<QueueItem, 'id' | 'status' | 'jobId' | 'fileId' | 'progress' | 'stage' | 'error'>) => {
      const newItem: QueueItem = {
        ...item,
        id: crypto.randomUUID(),
        status: 'waiting',
        jobId: null,
        fileId: null,
        progress: 0,
        stage: null,
        error: null,
      }
      setQueue((prev) => [...prev, newItem])
    },
    []
  )

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearQueue = useCallback(() => {
    eventSourceRef.current?.close()
    setQueue([])
    setIsProcessing(false)
    processingRef.current = false
  }, [])

  const downloadFile = useCallback((id: string) => {
    const item = queueRef.current.find((q) => q.id === id)
    if (item?.fileId) {
      window.location.assign(`/api/files/download/${item.fileId}`)
    }
  }, [])

  const downloadAllReady = useCallback(() => {
    const readyItems = queueRef.current.filter((q) => q.status === 'complete' && q.fileId)
    readyItems.forEach((item, index) => {
      setTimeout(() => {
        if (item.fileId) {
          const link = document.createElement('a')
          link.href = `/api/files/download/${item.fileId}`
          link.download = ''
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }, index * 1000)
    })
  }, [])

  const startQueue = useCallback(() => {
    if (processingRef.current) return
    const hasWaiting = queueRef.current.some((q) => q.status === 'waiting')
    if (!hasWaiting) return

    setIsProcessing(true)
    processingRef.current = true
    processNext()
  }, [processNext])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  return {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    clearQueue,
    startQueue,
    downloadFile,
    downloadAllReady,
  }
}
