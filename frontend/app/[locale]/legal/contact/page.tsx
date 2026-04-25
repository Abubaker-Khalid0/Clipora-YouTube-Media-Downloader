import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type Props = {
  params: Promise<{ locale: string }>
}

/**
 * Contact stub page — /[locale]/legal/contact
 * FR-008, SC-003 — Returns HTTP 200, matches landing page design.
 */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('legal')

  return (
    <main className="min-h-screen bg-background-light flex flex-col items-center justify-center px-4 py-16">
      <div className="glass-panel rounded-3xl p-10 sm:p-12 text-center shadow-2xl max-w-lg w-full mx-auto">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10 mx-auto">
          <span className="text-3xl" aria-hidden="true">✉️</span>
        </div>
        <h1 className="text-3xl font-extrabold text-primary mb-3">
          {t('comingSoon')}
        </h1>
        <p className="text-gray-600 font-medium leading-relaxed">
          {t('comingSoonSub')}
        </p>
        <Link
          href={`/${locale}`}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary
                     px-6 py-3 text-sm text-white font-extrabold
                     shadow-lg transition-all duration-300
                     hover:bg-[#c91e26] hover:scale-105"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Home
        </Link>
      </div>
    </main>
  )
}
