'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, CheckCircle2, Info, Lock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

/**
 * ChangePasswordForm — T006 (Phase 4: US2)
 *
 * Client Component. Handles three render states:
 *   A. Email/password user — full password change form
 *   B. Google OAuth user  — informational notice, no form
 *   C. Locked             — 5+ failed attempts in lockout window
 *
 * Design reference: docs/design-reference.md §Dashboard
 *   - Container: bg-white rounded-2xl border-slate-200 shadow-sm
 *   - Inputs: h-12 rounded-xl border-slate-200 focus:ring-primary
 *   - Primary button: bg-primary hover:bg-red-600 rounded-xl shadow-lg shadow-red-100
 *   - Transitions: transition-all duration-300
 *
 * Rate-limiting:
 *   - Tracks consecutive failures in localStorage key "clipora_pw_lockout"
 *   - Locks for 15 minutes after 5 consecutive wrong-password errors
 *   - Lockout survives page refresh
 *
 * Two-step verification:
 *   1. signInWithPassword (verifies current password)
 *   2. updateUser         (updates to new password)
 */

const LOCKOUT_KEY = 'clipora_pw_lockout'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

interface LockoutData {
  lockUntil: number
  attempts: number
}

interface ChangePasswordFormProps {
  email: string
  provider: string // "google" | "email"
}

export function ChangePasswordForm({ email, provider }: ChangePasswordFormProps) {
  const t = useTranslations('profile')

  // Form field state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Visibility toggles
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Feedback state
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Per-field inline errors
  const [fieldErrors, setFieldErrors] = useState<{
    current?: string
    new?: string
    confirm?: string
  }>({})

  // Rate-limiting
  const [failureCount, setFailureCount] = useState(0)
  const [lockUntil, setLockUntil] = useState<number | null>(null)

  // ── Mount: restore lockout from localStorage ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCKOUT_KEY)
      if (raw) {
        const data: LockoutData = JSON.parse(raw)
        if (data.lockUntil > Date.now()) {
          setLockUntil(data.lockUntil)
          setFailureCount(data.attempts)
        } else {
          localStorage.removeItem(LOCKOUT_KEY)
        }
      }
    } catch {
      // Malformed localStorage entry — ignore
    }
  }, [])

  const isLocked = lockUntil !== null && lockUntil > Date.now()
  const isOAuth = provider === 'google'

  // ── Field-level validation ─────────────────────────────────────────
  const validateFields = useCallback((): boolean => {
    const errors: typeof fieldErrors = {}

    if (!currentPassword) {
      errors.current = t('errorWrongPassword')
    }
    if (newPassword.length < 8) {
      errors.new = t('errorMinLength')
    }
    if (confirmPassword !== newPassword) {
      errors.confirm = t('errorMismatch')
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }, [currentPassword, newPassword, confirmPassword, t])

  // ── Submit handler ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage(null)
    setErrorMessage(null)

    if (!validateFields()) return

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Step 1: Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })

      if (signInError) {
        // Wrong current password — increment failure count
        const newCount = failureCount + 1
        setFailureCount(newCount)

        if (newCount >= MAX_ATTEMPTS) {
          // Lock the form
          const until = Date.now() + LOCKOUT_MS
          setLockUntil(until)
          try {
            localStorage.setItem(
              LOCKOUT_KEY,
              JSON.stringify({ lockUntil: until, attempts: newCount })
            )
          } catch {
            // localStorage unavailable — in-memory lockout still applies
          }
        } else {
          setErrorMessage(t('errorWrongPassword'))
        }
        return
      }

      // Step 2: Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        setErrorMessage(t('errorGeneric'))
        return
      }

      // Success — show toast, reset form, clear lockout
      setSuccessMessage(t('successMessage'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFailureCount(0)
      setLockUntil(null)
      try {
        localStorage.removeItem(LOCKOUT_KEY)
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Shared container ───────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-lg font-extrabold text-slate-900 mb-4">
        {t('changePassword')}
      </h2>

      {/* ── State B: Google OAuth ──────────────────────────────────── */}
      {isOAuth && (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <Info size={18} className="text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-500">{t('oauthNotice')}</p>
        </div>
      )}

      {/* ── State C: Locked ───────────────────────────────────────── */}
      {!isOAuth && isLocked && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <Lock size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            {t('lockoutNotice')}
          </p>
        </div>
      )}

      {/* ── State A: Password form ────────────────────────────────── */}
      {!isOAuth && !isLocked && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">

            {/* Current Password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                {t('currentPassword')}
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  onBlur={() => {
                    if (!currentPassword)
                      setFieldErrors((p) => ({ ...p, current: t('errorWrongPassword') }))
                    else
                      setFieldErrors((p) => ({ ...p, current: undefined }))
                  }}
                  className="w-full h-12 rounded-xl border border-slate-200 px-4 pr-11
                             text-sm font-medium text-slate-900 bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary
                             focus:border-primary transition-colors duration-300"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600 transition-colors duration-300
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-primary rounded-sm"
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.current && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.current}</p>
              )}
            </div>

            {/* New Password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                {t('newPassword')}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => {
                    if (newPassword.length > 0 && newPassword.length < 8)
                      setFieldErrors((p) => ({ ...p, new: t('errorMinLength') }))
                    else
                      setFieldErrors((p) => ({ ...p, new: undefined }))
                  }}
                  className="w-full h-12 rounded-xl border border-slate-200 px-4 pr-11
                             text-sm font-medium text-slate-900 bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary
                             focus:border-primary transition-colors duration-300"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showNew ? 'Hide new password' : 'Show new password'}
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600 transition-colors duration-300"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.new && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.new}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">
                {t('confirmPassword')}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => {
                    if (confirmPassword && confirmPassword !== newPassword)
                      setFieldErrors((p) => ({ ...p, confirm: t('errorMismatch') }))
                    else
                      setFieldErrors((p) => ({ ...p, confirm: undefined }))
                  }}
                  className="w-full h-12 rounded-xl border border-slate-200 px-4 pr-11
                             text-sm font-medium text-slate-900 bg-white
                             focus:outline-none focus:ring-2 focus:ring-primary
                             focus:border-primary transition-colors duration-300"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide confirmation' : 'Show confirmation'}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600 transition-colors duration-300"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {fieldErrors.confirm && (
                <p className="text-xs text-red-500 mt-0.5">{fieldErrors.confirm}</p>
              )}
            </div>

          </div>

          {/* Generic error */}
          {errorMessage && !Object.keys(fieldErrors).length && (
            <p className="text-sm text-red-500 mt-3">{errorMessage}</p>
          )}

          {/* Success toast */}
          {successMessage && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl
                         bg-green-50 border border-green-200
                         text-green-700 text-sm font-medium mt-4"
            >
              <CheckCircle2 size={16} className="flex-shrink-0" />
              {successMessage}
            </div>
          )}

          {/* Submit button — dashboard primary button style */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-red-600 text-white
                       font-extrabold py-3.5 rounded-xl
                       shadow-lg shadow-red-100
                       transition-all duration-300
                       flex items-center justify-center gap-2 mt-5
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('saving')}
              </>
            ) : (
              t('saveChanges')
            )}
          </button>
        </form>
      )}
    </div>
  )
}
