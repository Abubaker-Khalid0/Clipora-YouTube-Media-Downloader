import type { Metadata } from "next"
import { getLocale, getMessages, getTranslations } from "next-intl/server"
import { NextIntlClientProvider } from "next-intl"
import { Navbar } from "@/components/landing/Navbar"
import { NotFoundContent } from "@/components/special/NotFoundContent"

export const metadata: Metadata = {
  title: "Page Not Found — Clipora",
  robots: {
    index: false,
    follow: false,
  },
}

/**
 * Root-level custom 404 page.
 *
 * Lives OUTSIDE app/[locale]/, so it does NOT inherit [locale]/layout.tsx.
 * Therefore it must:
 *   1. Resolve the locale itself via getLocale() (set by middleware.ts)
 *   2. Set <html lang> and <body dir> manually
 *   3. Provide its own <NextIntlClientProvider> for client components (Navbar)
 *   4. Load its own messages via getMessages()
 */
export default async function NotFoundPage() {
  const locale = await getLocale()
  const messages = await getMessages()
  const t = await getTranslations("notFound")
  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <html lang={locale} dir={dir}>
      <body className="font-['Manrope',sans-serif] antialiased">
        <NextIntlClientProvider messages={messages}>
          <div className="min-h-screen bg-background-light flex flex-col">
            <Navbar locale={locale} />
            <NotFoundContent
              heading={t("heading")}
              message={t("message")}
              cta={t("cta")}
            />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
