import { NextResponse } from 'next/server'
import { createClient } from './supabase-server'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

type AppSupabaseClient = SupabaseClient<Database>

export type AuthenticatedContext = {
  user: User
  supabase: AppSupabaseClient
}

/**
 * T004 — Session guard for Next.js App Router API route handlers.
 *
 * Returns an AuthenticatedContext if the request carries a valid Supabase
 * session. Returns a NextResponse with status 401 if the session is missing
 * or expired.
 *
 * Usage:
 *   const result = await requireSession()
 *   if (result instanceof NextResponse) return result
 *   const { user, supabase } = result
 */
export async function requireSession(): Promise<
  AuthenticatedContext | NextResponse
> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || user === null) {
    return NextResponse.json(
      { success: false, data: null, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return { user, supabase }
}
