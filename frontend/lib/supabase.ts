import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'
import { env } from './env'

/**
 * Supabase browser client factory.
 * Call inside Client Components and hooks.
 * Env vars are validated at import time via env.ts (FR-002a).
 */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey)
}

export type SupabaseClient = ReturnType<typeof createBrowserClient<Database>>


