'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseCreditsResult {
  credits: number
  loading: boolean
  hasError: boolean
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * T006 — useCredits
 *
 * Subscribes to the current user's credit balance in real time via Supabase.
 * Updates immediately when credits are deducted after a job completes.
 *
 * hasError is set to true when the initial fetch fails — callers should
 * render an error state rather than showing "0 credits" misleadingly.
 */
export function useCredits(): UseCreditsResult {
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let activeChannel: ReturnType<typeof supabase.channel> | null = null

    async function run() {
      const { data: { user } } = await supabase.auth.getUser()

      if (cancelled) return

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      if (error) {
        console.error('[useCredits:fetch-failed]', {
          hook: 'useCredits',
          event: 'fetch-failed',
          message: error.message,
          time: new Date().toISOString(),
        })
        setHasError(true)
        setLoading(false)
        return
      }

      if (data) {
        setCredits(data.credits)
        setHasError(false)
      }

      setLoading(false)

      activeChannel = supabase
        .channel('credits-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (cancelled) return
            const updated = payload.new as { credits: number }
            setCredits(updated.credits)
          }
        )
        .subscribe()
    }

    run()

    return () => {
      cancelled = true
      if (activeChannel) {
        supabase.removeChannel(activeChannel)
        activeChannel = null
      }
    }
  }, [])

  return { credits, loading, hasError }
}