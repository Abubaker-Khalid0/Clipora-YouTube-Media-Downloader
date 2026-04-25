"use client"

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Image from 'next/image'

export function Navbar({ locale }: { locale: string }) {
  const t = useTranslations('landing.navbar')

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 dark:border-white/10 glass-panel">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-20 items-center justify-between">
                <Link href={`/${locale}`} className="flex items-center gap-2">
                    <Image src="/static/images/logo.png" alt="Clipora" width={32} height={32} className="h-8 w-8 object-contain" />
                    <span className="text-2xl font-extrabold tracking-tight">Clipora</span>
                </Link>
                <div className="flex items-center gap-4">
                    <Link href={`/${locale}/auth`}
                        className="hidden text-sm font-bold text-gray-700 hover:text-primary dark:text-gray-200 dark:hover:text-primary sm:block">
                        {t('login')}
                    </Link>
                    <Link href={`/${locale}/auth#signup`}
                        className="flex h-10 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95">
                        {t('start')}
                    </Link>
                </div>
            </div>
        </div>
    </nav>
  )
}
