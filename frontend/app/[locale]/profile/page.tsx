import { createClient } from '@/lib/supabase-server'
import { getLocale } from 'next-intl/server'
import { ProfileCard } from '@/components/profile/ProfileCard'
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm'
import { PromoCodeForm } from '@/components/profile/PromoCodeForm'
import { LogoutButton } from '@/components/profile/LogoutButton'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { Link } from '@/lib/navigation'

/**
 * Profile Page — final shell after T005 + T007 + T009
 *
 * Auth-gating: handled upstream by proxy.ts.
 *
 * Renders:
 *   - DashboardNavbar    (shared navigation)  ✅
 *   - ProfileCard        (T004/T005 — US1)  ✅
 *   - ChangePasswordForm (T006/T007 — US2)  ✅
 *   - LogoutButton       (T008/T009 — US3)  ✅
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  await getLocale() // locale consumed by child Server Components

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('id, full_name, credits, created_at')
        .eq('id', user.id)
        .single()
    : { data: null }

  const email = user?.email ?? ''
  const provider = (user?.app_metadata?.provider as string) ?? 'email'

  const fullName = profile?.full_name ?? email.split('@')[0] ?? 'User'
  const userInitial = fullName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50 font-sans">
      <DashboardNavbar userName={fullName} userInitial={userInitial} />

      <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* ← Back to Dashboard */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors w-fit group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </Link>

        {/* ── US1: Profile information ──────────────────────────────── */}
        <ProfileCard
          fullName={profile?.full_name ?? ''}
          email={email}
          credits={profile?.credits ?? 0}
          createdAt={profile?.created_at ?? ''}
        />

        {/* ── US2: Change password ──────────────────────────────────── */}
        <ChangePasswordForm email={email} provider={provider} />

        {/* ── US4: Promo code redemption ──────────────────────────────── */}
        <PromoCodeForm />

        {/* ── US3: Logout ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <LogoutButton />
        </div>

      </main>
    </div>
  )
}
