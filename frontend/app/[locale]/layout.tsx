import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/routing'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import ErrorTrackingInit from '@/components/ui/ErrorTrackingInit'
import '../globals.css'

// Google Fonts are loaded via standard link tags in the head for full control over weights.

// Site-wide fallback metadata — individual pages override with generateMetadata()
export const metadata: Metadata = {
  title: {
    default: 'Clipora — YouTube Downloader, Trimmer & Converter',
    template: '%s | Clipora',
  },
  description:
    'Download, trim, and convert YouTube videos for free. No credit card required.',
}

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

/**
 * Locale-specific root layout.
 * - Sets the `lang` attribute from the [locale] segment.
 * - Sets `dir="rtl"` for Arabic, `dir="ltr"` for English.
 * - Loads the Manrope font (constitution rule: Manrope only).
 * - Provides next-intl messages to Client Components via NextIntlClientProvider.
 * - Renders LanguageSwitcher on every page (FR-017).
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  // Validate locale — show 404 if unsupported
  if (!routing.locales.includes(locale as 'en' | 'ar')) {
    notFound()
  }

  const messages = await getMessages()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&amp;display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-['Manrope',sans-serif] antialiased">
        <NextIntlClientProvider messages={messages}>
          <ErrorTrackingInit />
          {/* LanguageSwitcher — fixed top-right (RTL: top-left), visible on every page (FR-017) */}
          <div className="fixed top-4 end-4 z-50">
            <LanguageSwitcher />
          </div>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
