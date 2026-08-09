/**
 * env.ts — Startup environment variable validation
 *
 * Simplified: no Supabase vars required during development.
 */

const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL

function validateEnv() {
  if (!NEXT_PUBLIC_APP_URL) {
    throw new Error(
      'Missing required environment variable: NEXT_PUBLIC_APP_URL\n' +
      'Copy frontend/.env.example to frontend/.env.local and fill in all values.'
    )
  }
}

validateEnv()

export const env = {
  // ── Public (browser-safe) ───────────────────────────────────────────────
  appUrl: NEXT_PUBLIC_APP_URL as string,

  // ── Server-only ─────────────────────────────────────────────────────────
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
} as const
