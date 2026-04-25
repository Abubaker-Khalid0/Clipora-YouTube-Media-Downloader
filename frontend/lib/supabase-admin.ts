import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * CE-03 FIX — Supabase Admin Client Factory
 *
 * This client uses the SERVICE ROLE KEY which bypasses Row Level Security (RLS).
 * It must ONLY be used for privileged server-side operations where:
 *   1. The caller has already verified the user's identity and authorization.
 *   2. The operation CANNOT succeed through the anon/session client due to
 *      RLS restrictions (e.g., the deduct_credits RPC modifying profiles rows
 *      owned server-side, or the jobs status update that must succeed even
 *      if the user's session expires mid-download).
 *
 * ⚠️  NEVER expose this client or its key to the browser.
 * ⚠️  NEVER use this client for reads that should be RLS-protected.
 * ⚠️  This file must only be imported from Server Components, Route Handlers,
 *     and middleware — never from 'use client' code.
 *
 * Current authorized use-cases:
 *   - deductCredits() → calls `deduct_credits` RPC (modifies profiles)
 *   - Updating jobs.status after SSE stream completes (user session may expire)
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY\n' +
      'This key is required for privileged server-side operations (credit deduction).\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }

  // auth.persistSession: false — admin client never hydrates a user session.
  // auth.autoRefreshToken: false — no background refresh needed for service role.
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
