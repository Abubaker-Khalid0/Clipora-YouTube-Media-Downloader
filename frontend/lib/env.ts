/**
 * env.ts — Startup environment variable validation (FR-002a)
 *
 * IMPORTANT: Turbopack/Next.js only replaces process.env.NEXT_PUBLIC_* when
 * accessed as a STRING LITERAL (not via a dynamic key like process.env[variable]).
 * Each variable MUST be read individually by name for client-bundle inlining to work.
 */

// Read each var explicitly — string literals required for Turbopack to inline them
const NEXT_PUBLIC_SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const NEXT_PUBLIC_APP_URL        = process.env.NEXT_PUBLIC_APP_URL

// Server-only — NOT read here to avoid being bundled into the client bundle.
// Accessed lazily via the getter below, which only runs in server context.

function validateEnv() {
  if (!NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }
  if (!NEXT_PUBLIC_APP_URL) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_APP_URL\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }
  // Note: BACKEND_URL is NOT validated here — it is server-only and must not
  // be referenced at module evaluation time to avoid crashing client bundles.
}

validateEnv()

/**
 * Type-safe accessor for validated public env vars.
 * Use instead of process.env directly to get full TypeScript safety.
 */
export const env = {
  // ── Public (browser-safe) ───────────────────────────────────────────────
  supabaseUrl:    NEXT_PUBLIC_SUPABASE_URL   as string,
  supabaseAnonKey: NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  appUrl:         NEXT_PUBLIC_APP_URL        as string,

  // ── Server-only ─────────────────────────────────────────────────────────
  // Accessed as a getter so the value is read — and validated — only when
  // this property is first used, which only happens in server-side code.
  // This prevents BACKEND_URL from being evaluated in the client bundle.
  get backendUrl(): string {
    const val = process.env.BACKEND_URL
    if (!val) {
      throw new Error(
        'Missing required environment variable: BACKEND_URL\n' +
        'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
      )
    }
    return val
  },

  // Server-only shared secret sent to FastAPI as X-Internal-Api-Key.
  // Never expose this to the client bundle.
  get internalApiKey(): string {
    const val = process.env.INTERNAL_API_KEY
    if (!val) {
      throw new Error(
        'Missing required environment variable: INTERNAL_API_KEY\n' +
        'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
      )
    }
    return val
  },

  // Server-only Supabase service role key.
  // Used by createAdminClient() for privileged operations that bypass RLS
  // (credit deduction, job status updates). Never expose to the client bundle.
  get supabaseServiceRoleKey(): string {
    const val = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!val) {
      throw new Error(
        'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY\n' +
        'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
      )
    }
    return val
  },
} as const

