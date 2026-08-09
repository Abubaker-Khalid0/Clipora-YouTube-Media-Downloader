import type { Metadata } from 'next'
import { Navbar } from '@/components/landing/Navbar'
import { HeroSection } from '@/components/landing/HeroSection'
import { FormatMarquee } from '@/components/landing/FormatMarquee'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { StatsStrip } from '@/components/landing/StatsStrip'
import { FaqSection } from '@/components/landing/FaqSection'
import { FinalCta } from '@/components/landing/FinalCta'
import { Footer } from '@/components/landing/Footer'

// PricingSection stays out until Stripe is wired — there is no billing yet.

export const metadata: Metadata = {
  title: 'Clipora — YouTube Downloader, Trimmer & Transcript Tool',
  description:
    'Download YouTube videos up to 4K, extract audio, trim exact segments, grab thumbnails, and pull full transcripts. No account, no watermark, files auto-deleted.',
  openGraph: {
    title: 'Clipora — YouTube Downloader, Trimmer & Transcript Tool',
    description:
      'Download up to 4K, extract audio, trim segments, and pull transcripts. No account required.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Clipora — YouTube Downloader, Trimmer & Transcript Tool',
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
 * The section order walks a visitor from claim to proof to objection handling:
 * hero (what it is) → marquee (breadth) → features (what it does) →
 * how it works (how) → stats (hard numbers) → FAQ (objections) → final CTA.
 *
 * `landing-root` owns the canvas and text colour through theme tokens, so the
 * page follows the light/dark switch. It previously hard-coded
 * `bg-background-light`, which put white text on a #f8f6f6 background.
 */
export default async function LandingPage({ params }: Props) {
  const { locale } = await params

  return (
    <main className="landing-root min-h-screen">
      <Navbar locale={locale} />
      <HeroSection locale={locale} />
      <FormatMarquee />
      <FeatureGrid />
      <HowItWorks />
      <StatsStrip />
      <FaqSection />
      <FinalCta locale={locale} />
      <Footer locale={locale} />
    </main>
  )
}
