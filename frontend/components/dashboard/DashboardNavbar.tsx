'use client'

import { useTranslations } from 'next-intl'
import { Coins, ChevronDown, User } from 'lucide-react'
import Image from 'next/image'
import { Link } from '@/lib/navigation'
import { useCredits } from '@/hooks/useCredits'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

interface DashboardNavbarProps {
  userName: string
  userInitial: string
}

export function DashboardNavbar({ userName: _userName, userInitial }: DashboardNavbarProps) {
  const t = useTranslations('dashboard')
  const { credits, loading } = useCredits()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="relative transition-transform duration-300 group-hover:scale-105">
            <Image
              src="/static/images/logo.png"
              alt="Clipora"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
          </div>
          <span className="text-xl font-extrabold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Clipora
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Credits badge */}
          <div className="hidden md:flex items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-full px-4 py-2 transition-all duration-300 hover:shadow-md hover:shadow-amber-100/50">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Coins className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-amber-800 tabular-nums">
              {loading ? '···' : credits}
            </span>
            <span className="text-xs font-medium text-amber-500 hidden lg:inline">
              {t('credits') || 'credits'}
            </span>
          </div>

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* User avatar with dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 px-1.5 py-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold flex items-center justify-center shadow-md shadow-red-500/20 text-sm">
                {userInitial}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block transition-transform duration-200 group-hover:rotate-180" />
            </button>
            
            {/* Dropdown menu */}
            <div className="absolute right-0 mt-1 w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right scale-95 group-hover:scale-100">
              <div className="p-1.5">
                {/* Mobile credits */}
                <div className="md:hidden flex items-center gap-2 px-3 py-2.5 mb-1 bg-amber-50/50 rounded-lg">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-700">
                    {loading ? '···' : credits} credits
                  </span>
                </div>
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all duration-150"
                >
                  <User className="w-4 h-4" />
                  {t('profile')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
