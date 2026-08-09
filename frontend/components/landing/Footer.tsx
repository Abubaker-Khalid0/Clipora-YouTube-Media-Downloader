import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

/**
 * Footer â€” sitemap-style footer.
 *
 * The previous version hard-coded "Â© 2024" and English link labels while the
 * translation files already had a `{year}` placeholder. Year is now computed at
 * render time and every label comes from the message catalogue.
 */

const PRODUCT_LINKS = [
  { key: 'dashboard', path: 'dashboard' },
  { key: 'features', hash: '#features' },
  { key: 'howItWorks', hash: '#how-it-works' },
  { key: 'faq', hash: '#faq' },
] as const

const LEGAL_LINKS = [
  { key: 'privacy', path: 'legal/privacy' },
  { key: 'terms', path: 'legal/terms' },
  { key: 'contact', path: 'legal/contact' },
] as const

export async function Footer({ locale }: { locale: string }) {
  const t = await getTranslations('landing.footer')
  const year = new Date().getFullYear()

  return (
    <footer className="relative border-t border-hairline bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          {/* Brand column */}
          <div>
            <Link href={`/${locale}`} className="inline-flex items-center gap-2.5">
              <Image
                src="/static/images/logo.png"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 object-contain"
              />
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                Clipora
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-4">
              {t('tagline')}
            </p>
          </div>

          {/* Product column */}
          <nav aria-labelledby="footer-product">
            <h2
              id="footer-product"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-4"
            >
              {t('productHeading')}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.key}>
                  {'path' in link ? (
                    <Link
                      href={`/${locale}/${link.path}`}
                      className="text-sm text-ink-3 transition-colors hover:text-ink"
                    >
                      {t(`links.${link.key}`)}
                    </Link>
                  ) : (
                    <a
                      href={link.hash}
                      className="text-sm text-ink-3 transition-colors hover:text-ink"
                    >
                      {t(`links.${link.key}`)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal column */}
          <nav aria-labelledby="footer-legal">
            <h2
              id="footer-legal"
              className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-4"
            >
              {t('legalHeading')}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.key}>
                  <Link
                    href={`/${locale}/${link.path}`}
                    className="text-sm text-ink-3 transition-colors hover:text-ink"
                  >
                    {t(`links.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-hairline pt-6 sm:flex-row">
          <p className="text-xs text-ink-4">{t('copyright', { year })}</p>
          <p className="max-w-md text-center text-[11px] leading-relaxed text-ink-4 sm:text-end">
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  )
}
