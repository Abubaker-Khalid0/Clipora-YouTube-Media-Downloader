import { defineRouting } from 'next-intl/routing'

/**
 * Shared routing configuration used by middleware and i18n.ts.
 * Locales: English (default) and Arabic.
 */
export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
})
