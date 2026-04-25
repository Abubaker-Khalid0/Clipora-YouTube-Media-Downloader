import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { isFileExpired } from '@/lib/utils'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import { RecentActivity } from '@/components/dashboard/RecentActivity'

export type ActivityEntry = {
  id: string
  videoTitle: string | null
  thumbnailUrl: string | null
  mode: string | null
  format: string | null
  fileSizeBytes: number | null
  createdAt: string
  isExpired: boolean
}

interface DashboardPageProps {
  params: Promise<{ locale: string }>
}

/**
 * T012 — Dashboard page.tsx (Server Component)
 * Fetches session, profile (credits + full_name), and last 5 successful jobs server-side.
 * Redirects to /auth if no session.
 */
export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/${locale}/auth`)
  }

  // Fetch profile (credits + name)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, credits, created_at')
    .eq('id', user.id)
    .single()

  // Fetch last 5 successful jobs for Recent Activity
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, video_title, thumbnail_url, mode, format, file_size, created_at')
    .eq('user_id', user.id)
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(5)

  const activityEntries: ActivityEntry[] = (jobs ?? [])
    .map((job) => ({
      id: job.id,
      videoTitle: job.video_title,
      thumbnailUrl: job.thumbnail_url,
      mode: job.mode,
      format: job.format,
      fileSizeBytes: job.file_size,
      createdAt: job.created_at,
      isExpired: isFileExpired(job.created_at),
    }))
    .filter((entry) => !entry.isExpired)

  // First-login: no jobs + account created < 60s ago
  // Server Component: runs once per request, no re-renders — Date.now() is safe here.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const accountAgeMs = now - new Date(profile?.created_at ?? '').getTime()
  const isFirstLogin = activityEntries.length === 0 && accountAgeMs < 60_000

  const fullName = profile?.full_name ?? user.email?.split('@')[0] ?? 'there'
  const firstName = fullName.split(' ')[0]
  const userInitial = firstName.charAt(0).toUpperCase()
  const credits = profile?.credits ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50 relative">
      {/* Subtle background pattern */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: 'radial-gradient(circle, #64748b 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Sticky Navbar */}
      <DashboardNavbar
        userName={fullName}
        userInitial={userInitial}
      />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Interactive dashboard shell — all state lives here */}
        <DashboardClient
          isFirstLogin={isFirstLogin}
          firstName={firstName}
          credits={credits}
        />

        {/* Recent Activity — server-rendered, client-interactive for delete */}
        <RecentActivity entries={activityEntries} userId={user.id} />
      </main>
    </div>
  )
}
