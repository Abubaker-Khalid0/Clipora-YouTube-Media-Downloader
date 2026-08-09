import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

export type ActivityEntry = {
  id: string
  videoId: string | null
  videoTitle: string | null
  thumbnailUrl: string | null
  mode: string | null
  format: string | null
  fileSizeBytes: number | null
  createdAt: string
  isExpired: boolean
}

/**
 * Dashboard page — open access, no auth required.
 *
 * `app-root` paints the canvas from theme tokens. The previous shell hard-coded
 * `from-slate-50 via-white to-slate-50/50`, which stayed light in dark mode, and
 * used a fixed dotted overlay that scrolled independently of the content.
 */
export default async function DashboardPage() {
  return (
    <div className="app-root relative min-h-screen">
      {/* Ambient brand light, anchored to the top of the page rather than the
          viewport so it does not follow the scroll. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="aurora-blob aurora-blob--brand start-1/2 top-[-45%] h-[480px] w-[720px] -translate-x-1/2 opacity-70" />
        <div className="grid-lines absolute inset-0 opacity-50" />
      </div>

      <DashboardNavbar />

      <main className="relative mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 lg:px-10">
        <DashboardClient activityEntries={[]} userId="anonymous" />
      </main>
    </div>
  )
}
