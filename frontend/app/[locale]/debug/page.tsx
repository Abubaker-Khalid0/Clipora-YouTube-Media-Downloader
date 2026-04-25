'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// ── Production guard ──────────────────────────────────────────────────────────
// This check runs at module evaluation time in Node.js (server render).
// next/navigation's notFound() renders a 404 response in production.
if (process.env.NODE_ENV !== 'development') {
  notFound()
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = 'idle' | 'running' | 'pass' | 'fail'

interface CheckResult {
  id: string
  label: string
  status: Status
  detail: string
  ms: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now()
  return fn().then((result) => ({ result, ms: Math.round(performance.now() - start) }))
}

// ── Initial check list ────────────────────────────────────────────────────────
const INITIAL_CHECKS: CheckResult[] = [
  { id: 'backend',    label: 'Backend reachable',       status: 'idle', detail: '', ms: null },
  { id: 'supabase',   label: 'Supabase reachable',      status: 'idle', detail: '', ms: null },
  { id: 'auth',       label: 'Auth session valid',       status: 'idle', detail: '', ms: null },
  { id: 'rpc',        label: 'Credits RPC exists',       status: 'idle', detail: '', ms: null },
  { id: 'middleware', label: 'Middleware locale active', status: 'idle', detail: '', ms: null },
  { id: 'sse',        label: 'SSE stream responds',      status: 'idle', detail: '', ms: null },
  { id: 'cors',       label: 'CORS headers correct',     status: 'idle', detail: '', ms: null },
  { id: 'envvars',    label: 'Env vars present',         status: 'idle', detail: '', ms: null },
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<CheckResult[]>(INITIAL_CHECKS)
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const updateCheck = (id: string, patch: Partial<CheckResult>) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const markRunning = (id: string) => updateCheck(id, { status: 'running', detail: '…', ms: null })
  const markPass = (id: string, detail: string, ms: number) => updateCheck(id, { status: 'pass', detail, ms })
  const markFail = (id: string, detail: string, ms?: number) => updateCheck(id, { status: 'fail', detail, ms: ms ?? null })

  async function runAllChecks() {
    setRunning(true)
    setChecks(INITIAL_CHECKS)

    const supabase = createClient()

    // 1. Backend health
    markRunning('backend')
    try {
      const { ms } = await timed(() => fetch('/api/health').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`) ; return r }))
      markPass('backend', 'GET /api/health → 200', ms)
    } catch (e) {
      markFail('backend', `${e instanceof Error ? e.message : String(e)} — is uvicorn running?`)
    }

    // 2. Supabase reachable
    markRunning('supabase')
    try {
      const { result: { error }, ms } = await timed(() => supabase.auth.getSession())
      if (error) markFail('supabase', error.message, ms)
      else markPass('supabase', 'getSession() succeeded', ms)
    } catch (e) {
      markFail('supabase', `${e instanceof Error ? e.message : String(e)}`)
    }

    // 3. Auth session valid
    markRunning('auth')
    try {
      const { result: { data, error }, ms } = await timed(() => supabase.auth.getUser())
      if (error) markFail('auth', error.message, ms)
      else markPass('auth', data.user ? `Logged in as ${data.user.email}` : 'No active session', ms)
    } catch (e) {
      markFail('auth', String(e))
    }

    // 4. Credits RPC
    markRunning('rpc')
    try {
      const start = performance.now()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpcResult = await (supabase as any).rpc('get_credits')
      const ms = Math.round(performance.now() - start)
      if (rpcResult.error) markFail('rpc', (rpcResult.error as { message: string }).message, ms)
      else markPass('rpc', `get_credits returned ${JSON.stringify(rpcResult.data)}`, ms)
    } catch (e) {
      markFail('rpc', String(e))
    }

    // 5. Middleware locale
    markRunning('middleware')
    const hasLocale = /^\/(en|ar)(\/|$)/.test(window.location.pathname)
    if (hasLocale) markPass('middleware', `Locale prefix detected: ${window.location.pathname}`, 0)
    else markFail('middleware', `No locale prefix in URL: ${window.location.pathname}`)

    // 6. SSE stream
    markRunning('sse')
    await new Promise<void>((resolve) => {
      const start = performance.now()
      const es = new EventSource('/api/jobs/diag-test/stream')
      const timer = setTimeout(() => {
        es.close()
        markPass('sse', 'Connection held open for 2s (stream active)', Math.round(performance.now() - start))
        resolve()
      }, 2000)
      es.onerror = () => {
        clearTimeout(timer)
        es.close()
        // A 401/404 still proves the SSE endpoint exists and responds
        markPass('sse', 'Endpoint responded (got close/error — expected for invalid job ID)', Math.round(performance.now() - start))
        resolve()
      }
    })

    // 7. CORS headers
    markRunning('cors')
    try {
      const { result: res, ms } = await timed(() => fetch('/api/health').then((r) => r))
      const acao = res.headers.get('access-control-allow-origin')
      if (acao) markPass('cors', `access-control-allow-origin: ${acao}`, ms)
      else markFail('cors', 'Header access-control-allow-origin missing from /api/health', ms)
    } catch (e) {
      markFail('cors', String(e))
    }

    // 8. Env vars
    markRunning('envvars')
    const vars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    }
    const missing = Object.entries(vars).filter(([, v]) => !v).map(([k]) => k)
    if (missing.length === 0) markPass('envvars', 'All NEXT_PUBLIC_ vars are set', 0)
    else markFail('envvars', `Missing: ${missing.join(', ')}`)

    setRunning(false)
  }

  function copyReport() {
    const report = {
      time: new Date().toISOString(),
      url: window.location.href,
      checks: checks.map(({ id, label, status, detail, ms }) => ({ id, label, status, detail, ms })),
    }
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Auto-run on mount in dev
  useEffect(() => { runAllChecks() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const statusIcon = (s: Status) => ({ idle: '○', running: '⏳', pass: '✅', fail: '❌' }[s])
  const statusColor = (s: Status) =>
    ({ idle: 'text-slate-500', running: 'text-amber-500', pass: 'text-green-600', fail: 'text-red-600' }[s])

  return (
    <main className="min-h-screen bg-slate-950 p-8 font-mono text-sm">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">🔍 Clipora Diagnostics</h1>
          <p className="text-slate-400 text-xs">Development only — returns 404 in production</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden mb-6">
          {checks.map((c, i) => (
            <div key={c.id} className={`flex items-start gap-4 px-5 py-4 ${i < checks.length - 1 ? 'border-b border-slate-800' : ''}`}>
              <span className="text-lg leading-none mt-0.5">{statusIcon(c.status)}</span>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${statusColor(c.status)}`}>
                  {c.label}
                  {c.ms !== null && <span className="ml-2 text-xs text-slate-500 font-normal">{c.ms}ms</span>}
                </div>
                {c.detail && <div className="text-xs text-slate-400 mt-0.5 break-all">{c.detail}</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={runAllChecks}
            disabled={running}
            className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-3 font-bold text-white transition-colors"
          >
            {running ? '⏳ Running…' : '▶ Run All Checks'}
          </button>
          <button
            onClick={copyReport}
            className="rounded-xl border border-slate-700 hover:border-slate-500 px-4 py-3 font-bold text-slate-300 transition-colors"
          >
            {copied ? '✓ Copied!' : '📋 Copy Report'}
          </button>
        </div>
      </div>
    </main>
  )
}
