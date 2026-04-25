import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-guard'
import { deductCredits } from '@/lib/credits'
import { env } from '@/lib/env'
// CE-03 FIX: privileged DB operations (credit deduction, status update) use the
// admin client so they bypass RLS and succeed even when the user session expires
// mid-download.  The session client is still used for the ownership check (step 2).
import { createAdminClient } from '@/lib/supabase-admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type AppSupabaseClient = SupabaseClient<Database>

interface SSEEvent {
  stage?: string
  [key: string]: unknown
}

function parseSSE(dataStr: string): SSEEvent | null {
  const trimmed = dataStr.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as SSEEvent
  } catch {
    return null
  }
}

interface StreamState {
  terminalStatus: 'complete' | 'error' | null
  creditsUsed: number
  jobId: string
  userId: string
  supabase: AppSupabaseClient
  jobWasAlreadySuccess: boolean
}

/**
 * Creates a TransformStream that passes all chunks through unchanged while
 * inspecting SSE lines for terminal status signals.
 *
 * TextDecoder is created ONCE and reused across all chunks so that multi-byte
 * UTF-8 characters split across chunk boundaries are decoded correctly.
 * The `{ stream: true }` option keeps the decoder's internal buffer alive
 * between transform() calls.
 */
function createSSEParserTransform(state: StreamState): TransformStream<Uint8Array, Uint8Array> {
  // Single stateful decoder — must outlive individual transform() calls
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let buffer = ''

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      // { stream: true } keeps partial multi-byte chars in the decoder's
      // internal buffer until the next chunk completes them
      buffer += decoder.decode(chunk, { stream: true })

      const lines = buffer.split('\n')
      // The last element may be an incomplete line — keep it in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const event = parseSSE(line.slice(6))
          if (
            (event?.stage === 'complete' || event?.stage === 'error') &&
            state.terminalStatus === null
          ) {
            state.terminalStatus = event.stage as 'complete' | 'error'
          }
        }
      }

      // Pass the original chunk through unchanged
      controller.enqueue(chunk)
    },

    async flush(controller) {
      // Flush any remaining bytes from the decoder
      const remaining = decoder.decode(undefined, { stream: false })
      if (remaining) {
        buffer += remaining
      }

      // Process any last incomplete line in the buffer
      if (buffer) {
        for (const line of buffer.split('\n')) {
          if (line.startsWith('data: ')) {
            const event = parseSSE(line.slice(6))
            if (
              (event?.stage === 'complete' || event?.stage === 'error') &&
              state.terminalStatus === null
            ) {
              state.terminalStatus = event.stage as 'complete' | 'error'
            }
          }
        }
      }

      // Perform DB update and credit deduction only once
      if (state.terminalStatus && !state.jobWasAlreadySuccess) {
        if (state.terminalStatus === 'complete') {
          // Credits deducted before status update — order is intentional for idempotency.
          // If deduction fails, do NOT mark the job as success to avoid a state where
          // the user gets the file but credits were not deducted.
          if (state.creditsUsed > 0) {
            const deductResult = await deductCredits(
              state.supabase,
              state.userId,
              state.creditsUsed,
              state.jobId
            )
            if (!deductResult.success) {
              // Credit deduction failed — mark job as failed so the user is informed
              await state.supabase
                .from('jobs')
                .update({ status: 'failed' })
                .eq('id', state.jobId)
              controller.terminate()
              return
            }
          }
          await state.supabase
            .from('jobs')
            .update({ status: 'success' })
            .eq('id', state.jobId)
        } else {
          await state.supabase
            .from('jobs')
            .update({ status: 'failed' })
            .eq('id', state.jobId)
        }
      }

      controller.terminate()
    },
  })
}

/**
 * T008 — GET /api/jobs/[id]/stream
 *
 * Proxies the SSE stream from the FastAPI backend to the browser.
 * No timeout is applied — downloads can take minutes.
 *
 * On stream end:
 *  - stage=complete → deduct credits (idempotent), update jobs.status='success'
 *  - stage=error    → update jobs.status='failed', no credit deduction
 *  - already success → skip (reconnect protection)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const authResult = await requireSession()
  if (authResult instanceof NextResponse) return authResult
  const { user, supabase } = authResult

  const { id } = await params

  // ── 2. Load job + verify ownership ───────────────────────────────────────
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, status, credits_used')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { success: false, data: null, error: 'Job not found' },
      { status: 404 }
    )
  }

  // ── 3. Open upstream SSE connection (no timeout) ──────────────────────────
  const upstreamUrl = `${env.backendUrl}/api/jobs/${id}/stream`
  let upstreamResponse: Response

  try {
    upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        Accept: 'text/event-stream',
        'X-Internal-Api-Key': env.internalApiKey,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to connect to job stream' },
      { status: 502 }
    )
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    return NextResponse.json(
      { success: false, data: null, error: 'Job stream unavailable' },
      { status: 502 }
    )
  }

  // ── 4. Pipe through transform (inspect + pass through) ────────────────────
  //
  // CE-03 FIX: The admin client bypasses RLS for the two privileged operations
  // inside the transform:
  //   a) deductCredits — modifies profiles.credits (service-role RPC call)
  //   b) jobs status update — must succeed even if user session has expired
  //
  // Ownership is already verified in step 2 above using the session client.
  // We do NOT use the admin client for any reads that should be RLS-protected.
  const adminSupabase = createAdminClient()

  const streamState: StreamState = {
    terminalStatus: null,
    creditsUsed: job.credits_used ?? 0,
    jobId: id,
    userId: user.id,
    supabase: adminSupabase as AppSupabaseClient,
    jobWasAlreadySuccess: job.status === 'success',
  }

  const transform = createSSEParserTransform(streamState)
  const passThrough = upstreamResponse.body.pipeThrough(transform)

  return new Response(passThrough, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
