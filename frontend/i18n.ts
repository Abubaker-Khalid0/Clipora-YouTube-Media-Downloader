import { getRequestConfig } from 'next-intl/server'
import { routing } from './lib/routing'

/**
 * T008 – next-intl server configuration.
 * Loads locale-specific message files for each request.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // Validate that the incoming locale is supported
  const requested = await requestLocale
  const locale =
    requested && routing.locales.includes(requested as 'en' | 'ar')
      ? requested
      : routing.defaultLocale

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})

