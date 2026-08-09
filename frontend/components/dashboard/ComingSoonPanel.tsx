'use client'

import { useTranslations } from 'next-intl'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

/**
 * ComingSoonPanel — honest placeholder for the burned-in subtitle output.
 *
 * SubtitlePanel and SubtitleOverlay are still in the repo for that build, but
 * they are not rendered: the job contract has no subtitle field and the
 * processor has no burn-in step, so the editor could style captions and then
 * produce nothing. Saying "soon" is more use to a visitor than a control that
 * silently leads nowhere.
 */
export function ComingSoonPanel() {
  const t = useTranslations('dashboard')

  return (
    <div className="panel rounded-xl p-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-veil-2">
        <MaterialIcon name="closed_caption" size={22} className="text-ink-4" />
      </span>

      <h3 className="mt-4 text-sm font-bold text-ink">{t('subtitleSoonTitle')}</h3>

      <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-ink-3">
        {t('subtitleSoonBody')}
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
        <MaterialIcon name="schedule" size={12} />
        {t('comingSoon')}
      </span>
    </div>
  )
}
