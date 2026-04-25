/**
 * error-tracking.ts — Global browser-level error capture.
 *
 * Registers two window listeners:
 *   - unhandledrejection: catches async/await throws that escape a try/catch
 *   - error:             catches synchronous JS errors not caught by React
 *
 * Console output format:
 *   [UnhandledRejection] { reason, message, stack, time }
 *   [GlobalError]        { message, filename, line, column, stack, time }
 *
 * Call initErrorTracking() exactly once, from a 'use client' component,
 * inside a useEffect (not at module evaluation time).
 */

export function initErrorTracking(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    console.error('[UnhandledRejection]', {
      reason: event.reason,
      message: (event.reason as Error)?.message,
      stack: (event.reason as Error)?.stack,
      time: new Date().toISOString(),
    })
  })

  window.addEventListener('error', (event: ErrorEvent) => {
    console.error('[GlobalError]', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
      time: new Date().toISOString(),
    })
  })
}
