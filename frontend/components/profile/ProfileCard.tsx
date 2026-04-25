import { getLocale } from 'next-intl/server'
import { getTranslations } from 'next-intl/server'
import { Coins } from 'lucide-react'

/**
 * ProfileCard — T004 (Phase 3: US1)
 *
 * Server Component. Displays the user's identity card:
 *   - Large avatar circle with first letter of name
 *   - Full name and email
 *   - Credits badge (matches DashboardNavbar badge exactly per design-reference.md §Dashboard → Navbar)
 *   - "Member since" join date
 *
 * Design reference: docs/design-reference.md §Dashboard
 *   - Container: bg-white rounded-2xl border-slate-200 shadow-sm
 *   - Credits badge: bg-slate-100 rounded-full border-slate-200
 *   - Avatar: bg-primary rounded-full
 */

interface ProfileCardProps {
  fullName: string
  email: string
  credits: number
  createdAt: string // ISO date string from profiles.created_at
}

export async function ProfileCard({
  fullName,
  email,
  credits,
  createdAt,
}: ProfileCardProps) {
  const t = await getTranslations('profile')
  const locale = await getLocale()

  const initial = fullName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?'

  const formattedDate = createdAt
    ? new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(new Date(createdAt))
    : '—'

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6
                 flex flex-col items-center gap-4
                 sm:flex-row sm:items-center sm:gap-6"
    >
      {/* Avatar — red circle with first letter */}
      <div
        className="w-24 h-24 rounded-full bg-primary flex items-center
                   justify-center text-white text-4xl font-bold select-none flex-shrink-0"
        aria-label={`Avatar for ${fullName}`}
      >
        {initial}
      </div>

      {/* Info block */}
      <div className="flex flex-col min-w-0 items-center text-center sm:items-start sm:text-start">
        {/* Name */}
        <h1 className="text-2xl font-extrabold text-slate-900 truncate">
          {fullName || '—'}
        </h1>

        {/* Email */}
        <p className="text-sm text-slate-500 mt-0.5 truncate">{email}</p>

        {/* Credits badge — desktop (md+): matches DashboardNavbar credits badge exactly */}
        <div
          className="hidden md:flex items-center gap-2 text-sm font-semibold
                     text-slate-600 bg-slate-100 px-3 py-1.5
                     rounded-full border border-slate-200 w-fit mt-3"
        >
          <Coins size={16} className="text-yellow-500 flex-shrink-0" />
          <span>{t('creditsRemaining', { n: credits })}</span>
        </div>

        {/* Credits — mobile (below md): inline, no badge */}
        <p className="flex md:hidden items-center gap-1.5 text-sm font-semibold text-slate-600 mt-3">
          <Coins size={16} className="text-yellow-500 flex-shrink-0" />
          {t('creditsRemaining', { n: credits })}
        </p>

        {/* Join date */}
        <p className="text-xs text-slate-400 mt-2">
          {t('memberSince', { date: formattedDate })}
        </p>
      </div>
    </div>
  )
}
