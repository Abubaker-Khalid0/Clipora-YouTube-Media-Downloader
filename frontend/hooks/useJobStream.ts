'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JobStage =
  | 'initializing'
  | 'extracting_info'
  | 'downloading'
  | 'merging'
  | 'trimming'
  | 'finalizing'
  | 'complete'
  | 'error'

export interface JobStreamState {
  stage: JobStage | null
  percent: number
  fileId: string | null
  fileSizeBytes: number | null
  error: string | null
}

interface SSEPayload {
  stage: JobStage
  percent?: number
  file_id?: string
  fileSizeBytes?: number
  message?: string
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2_000

const TERMINAL_STAGES = new Set<JobStage>(['complete', 'error'])

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * T007 — useJobStream
 *
 * Opens an EventSource to /api/jobs/{jobId}/stream and parses SSE progress events.
 * Auto-reconnects silently on drop (max 3 retries, 2s delay each).
 *
 * Reconnects are suppressed once a terminal stage ('complete' | 'error') has
 * been received — prevents spurious backend reconnects after a successful download.
 */
export function useJobStream(jobId: string | null): JobStreamState {
  const [state, setState] = useState<JobStreamState>({
    stage: null,
    percent: 0,
    fileId: null,
    fileSizeBytes: null,
    error: null,
  })

  const retriesRef = useRef(0)
  const esRef = useRef<EventSource | null>(null)
  const isTerminalRef = useRef(false)
  const jobIdRef = useRef(jobId)

  useEffect(() => { jobIdRef.current = jobId }, [jobId])

  const log = useCallback(
    (level: 'info' | 'warn' | 'error', event: string, data?: object) => {
      console[level](`[useJobStream:${event}]`, {
        hook: 'useJobStream',
        jobId: jobIdRef.current,
        event,
        time: new Date().toISOString(),
        ...data,
      })
    },
    []
  )

  useEffect(() => {
    if (!jobId) return

    queueMicrotask(() => {
      setState({ stage: null, percent: 0, fileId: null, fileSizeBytes: null, error: null })
    })

    retriesRef.current = 0
    isTerminalRef.current = false

    function connect() {
      // Never reconnect once a terminal stage has been received.
      if (isTerminalRef.current) return

      const es = new EventSource(`/api/jobs/${jobId}/stream`)
      esRef.current = es
      log('info', 'connected')

      es.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as SSEPayload
          retriesRef.current = 0

          log('info', 'message', { stage: payload.stage, percent: payload.percent })

          setState((prev) => ({
            ...prev,
            stage: payload.stage,
            percent: payload.percent ?? prev.percent,
            fileId: payload.file_id ?? prev.fileId,
            fileSizeBytes: payload.fileSizeBytes ?? prev.fileSizeBytes,
            error: payload.stage === 'error'
              ? (payload.message ?? 'Processing failed')
              : null,
          }))

          if (TERMINAL_STAGES.has(payload.stage)) {
            isTerminalRef.current = true
            log('info', 'terminal', { stage: payload.stage })
            es.close()
          }
        } catch {
          // Malformed SSE payload — ignore and wait for the next event
        }
      }

      es.onerror = () => {
        es.close()

        // Do not retry if we already received a terminal stage.
        // The server closing the connection after 'complete' triggers onerror —
        // without this guard, every successful download would attempt 3 reconnects.
        if (isTerminalRef.current) {
          log('info', 'stream-closed-after-terminal')
          return
        }

        log('error', 'stream-error', { retries: retriesRef.current })

        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current += 1
          log('warn', 'retry', { attempt: retriesRef.current })
          setTimeout(connect, RETRY_DELAY_MS)
        } else {
          log('error', 'max-retries-exceeded')
          setState((prev) => ({
            ...prev,
            error: 'Connection lost. Please refresh and check your downloads.',
          }))
        }
      }
    }

    connect()

    return () => {
      esRef.current?.close()
    }
  }, [jobId, log])

  return state
}