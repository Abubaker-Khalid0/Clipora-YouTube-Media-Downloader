import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Footer } from '@/components/landing/Footer'

// import { PricingSection } from '@/components/landing/PricingSection'

// ── SEO Metadata (T007, FR-012, SC-008) ──────────────────────────────────────
export const metadata: Metadata = {
  title: 'Clipora — YouTube Downloader, Trimmer & Converter',
  description:
    'Download, trim, and convert YouTube videos for free. No credit card required. Start with 10 free credits.',
  openGraph: {
    title: 'Clipora — YouTube Downloader, Trimmer & Converter',
    description:
      'Download, trim, and convert YouTube videos for free.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Clipora — YouTube Downloader, Trimmer & Converter',
      },
    ],
  },
}

type Props = {
  params: Promise<{ locale: string }>
}

/**
 * Landing page — /[locale]/
 *
 * Phase 3 (US1): Navbar + HeroSection wired. ✅
 * Phase 4 (US2): HowItWorks wired. ✅
 * Phase 6 (US4): <Footer /> will be added at the bottom.
 *
 * PricingSection is intentionally commented out — enable when Stripe is ready:
 * {/* PRICING — Uncomment when Stripe is ready *\/}
 * {/* <PricingSection /> *\/}
 */
export default async function LandingPage({ params }: Props) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-background-light">
      <Navbar locale={locale} />
      <HeroSection locale={locale} />

      <HowItWorks />

      {/* PRICING — Uncomment when Stripe is ready */}
      {/* <PricingSection /> */}

      {/* Phase 6 (US4): Footer ✅ */}
      <Footer locale={locale} />
    </main>
  )
}
