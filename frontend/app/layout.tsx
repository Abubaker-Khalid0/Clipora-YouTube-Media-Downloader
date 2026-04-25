/**
 * Root layout — minimal pass-through.
 * All locale-aware HTML structure (html, body, lang, dir, font, next-intl)
 * is handled in app/[locale]/layout.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
