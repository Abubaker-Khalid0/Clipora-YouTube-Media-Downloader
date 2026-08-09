import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/routing'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import ErrorTrackingInit from '@/components/ui/ErrorTrackingInit'
import { ThemeProvider } from '@/components/ui/ThemeProvider'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
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
    // suppressHydrationWarning: THEME_INIT_SCRIPT mutates this element's class
    // and style before React hydrates, so a mismatch here is expected.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Must run before first paint, otherwise dark-mode visitors see a
            white flash while the bundle loads. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&amp;display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&amp;display=swap"
          rel="stylesheet"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&amp;display=swap"
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
          <ThemeProvider>
            <ErrorTrackingInit />
            {/* LanguageSwitcher and ThemeToggle are rendered by each surface's own
                header (Navbar on the landing page, DashboardNavbar in the app)
                rather than floating here — a fixed copy at this level overlapped
                the navbar CTA. */}
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
