'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Gift, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RedeemState = 'idle' | 'loading' | 'success' | 'error'

interface RedeemResult {
  creditsAwarded?: number
  errorKey?: string
}

// ---------------------------------------------------------------------------
// PromoCodeForm — Client Component
//
// Professional promo code redemption UI for the profile page.
// Features:
//   - Input with icon and submit button
//   - Loading state with spinner
//   - Success state with animation showing credits awarded
//   - Error states with descriptive messages
//   - Auto-uppercase input styling
//   - Rate limit awareness
// ---------------------------------------------------------------------------

export function PromoCodeForm() {
  const t = useTranslations('profile')
  const [code, setCode] = useState('')
  const [state, setState] = useState<RedeemState>('idle')
  const [result, setResult] = useState<RedeemResult>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmed = code.trim()
    if (!trimmed) return

    setState('loading')
    setResult({})

    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })

      const data = await res.json()

      if (data.success) {
        setState('success')
        setResult({ creditsAwarded: data.data.creditsAwarded })
        setCode('')
      } else {
        setState('error')
        setResult({ errorKey: data.error || 'serverError' })
      }
    } catch {
      setState('error')
      setResult({ errorKey: 'serverError' })
    }
  }

  const handleReset = () => {
    setState('idle')
    setResult({})
    setCode('')
    inputRef.current?.focus()
  }

  const getErrorMessage = (key: string): string => {
    const messages: Record<string, string> = {
      invalidCode: t('promoInvalidCode'),
      alreadyUsed: t('promoAlreadyUsed'),
      expired: t('promoExpired'),
      maxUsesReached: t('promoMaxUses'),
      serverError: t('promoServerError'),
    }
    return messages[key] ?? messages.serverError
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Gift className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('promoTitle')}</h2>
            <p className="text-sm text-slate-500">{t('promoSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Form / Result */}
      <div className="px-6 pb-6">
        {state === 'success' ? (
          /* ── Success State ──────────────────────────────────────────── */
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 p-5">
            {/* Decorative sparkles */}
            <div className="absolute top-2 right-3 animate-pulse">
              <Sparkles className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="absolute bottom-3 left-4 animate-pulse delay-300">
              <Sparkles className="w-4 h-4 text-emerald-200" />
            </div>

            <div className="flex flex-col items-center text-center gap-3 relative z-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-[bounce_0.6s_ease-in-out]">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-800">
                  {t('promoSuccess')}
                </p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  +{result.creditsAwarded} {t('promoCreditsLabel')}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 underline underline-offset-2 transition-colors"
              >
                {t('promoRedeemAnother')}
              </button>
            </div>
          </div>
        ) : (
          /* ── Input State ───────────────────────────────────────────── */
          <>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  id="promo-code-input"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    if (state === 'error') setState('idle')
                  }}
                  placeholder={t('promoPlaceholder')}
                  maxLength={50}
                  disabled={state === 'loading'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl
                             text-sm font-mono font-semibold tracking-wider text-slate-800
                             placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal
                             focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400
                             disabled:opacity-60 disabled:cursor-not-allowed
                             transition-all duration-200 uppercase"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                disabled={!code.trim() || state === 'loading'}
                className="px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600
                           text-white font-semibold text-sm rounded-xl
                           shadow-lg shadow-violet-500/25
                           hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02]
                           active:scale-[0.98]
                           disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg
                           transition-all duration-200
                           flex items-center gap-2 whitespace-nowrap"
              >
                {state === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">{t('promoRedeeming')}</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('promoRedeem')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Error message */}
            {state === 'error' && result.errorKey && (
              <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl animate-[fadeIn_0.2s_ease-in-out]">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm font-medium text-red-700">
                  {getErrorMessage(result.errorKey)}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
