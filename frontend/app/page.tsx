import { redirect } from 'next/navigation'
import { routing } from '@/lib/routing'

/**
 * Root route `/`
 *
 * next-intl rewrites localised paths (e.g. `/en/...`) but the bare root `/`
 * is still served by this file.  Rather than duplicating any UI here we issue
 * a permanent (308) redirect to the default locale so that users always land
 * on a fully-localised Clipora page.
 *
 * The middleware handles every subsequent navigation, so this redirect is only
 * hit when a user or crawler reaches the bare domain root (e.g. clipora.app/).
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`)
}
