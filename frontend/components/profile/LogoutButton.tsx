'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LogOut, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'

/**
 * LogoutButton — T008 (Phase 5: US3)
 *
 * Client Component. Provides a safe, confirmed logout flow:
 *   1. User clicks "Log Out" → Dialog opens for confirmation
 *   2. User cancels → Dialog closes, session intact
 *   3. User confirms → session terminated, redirect to /[locale]/auth
 *
 * Reuses the existing useAuth().logout() which calls:
 *   supabase.auth.signOut() + router.push(`/${locale}/auth`)
 *
 * Design reference: docs/design-reference.md §Dashboard → Modals
 *   - Dialog card: bg-white rounded-2xl shadow-2xl
 *   - Confirm button: bg-primary hover:bg-red-600 rounded-xl shadow-lg shadow-red-100
 *   - Cancel button: outlined, rounded-xl
 *   - Transitions: transition-all duration-300
 */
export function LogoutButton() {
  const t = useTranslations('profile')
  const { logout } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
      // After logout(), useAuth redirects to /[locale]/auth
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Trigger — destructive outlined style per design-reference.md */}
      <DialogTrigger
        render={
          <button
            id="logout-trigger-btn"
            className="w-full h-12 text-red-500 border border-red-200 rounded-xl
                       font-bold hover:bg-red-50 transition-colors duration-300
                       flex items-center justify-center gap-2
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-primary focus-visible:ring-offset-2"
          />
        }
      >
        <LogOut size={16} aria-hidden="true" />
        {t('logout')}
      </DialogTrigger>

      {/* Confirmation dialog — matches Modals style in design-reference.md §Dashboard */}
      <DialogContent
        showCloseButton={false}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl
                   max-w-[400px] p-8"
      >
        <DialogHeader>
          <DialogTitle
            className="font-extrabold text-slate-900 text-lg leading-tight"
          >
            {t('logoutTitle')}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm mt-1">
            {t('logoutDescription')}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="border-t-0 bg-transparent px-0 pb-0 pt-4 mt-2
                                  flex flex-col gap-3 sm:flex-col">
          {/* Confirm — primary button */}
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full bg-primary hover:bg-red-600 text-white font-bold
                       py-3 rounded-xl shadow-lg shadow-red-100
                       transition-all duration-300
                       flex items-center justify-center gap-2
                       disabled:opacity-60 disabled:cursor-not-allowed
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              t('logoutConfirm')
            )}
          </button>

          {/* Cancel — secondary action per design-reference.md §Dashboard → Modals */}
          <DialogClose
            render={
              <button
                className="w-full text-slate-400 hover:text-slate-600
                           font-bold text-sm py-2 transition-colors duration-300
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-primary focus-visible:ring-offset-2"
              />
            }
          >
            {t('logoutCancel')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
