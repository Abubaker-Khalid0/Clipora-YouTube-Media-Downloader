import Link from 'next/link'

export function PricingSection({ locale }: { locale: string }) {

  return (
    <section className="relative py-24 w-full bg-white/50 dark:bg-black/20">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
                <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
                    Simple, transparent pricing</h2>
                <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">Choose the perfect plan for your
                    downloading needs.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="glass-panel relative flex flex-col rounded-3xl p-8 shadow-xl">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Starter</h3>
                    <div className="mt-4 flex items-baseline">
                        <span className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">$0</span>
                        <span className="ml-1 text-sm font-medium text-gray-500">/ forever</span>
                    </div>
                    <ul className="mt-8 space-y-4 flex-1">
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            2 YouTube Downloads (1080p)
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            2 Video Trim Operations
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Basic Support
                        </li>
                        <li
                            className="flex items-center gap-3 text-sm font-medium text-gray-400 dark:text-gray-500 opacity-60">
                            <span className="material-symbols-outlined text-lg">close</span>
                            No Audio Conversion
                        </li>
                    </ul>
                    <Link href={`/${locale}/auth#signup`}
                        className="mt-8 flex h-12 w-full items-center justify-center rounded-full border-2 border-primary/20 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-white">
                        Get Started
                    </Link>
                </div>
                <div className="glass-panel relative flex flex-col rounded-3xl p-8 shadow-xl border-primary/10">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Pro</h3>
                    <div className="mt-4 flex items-baseline">
                        <span className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">$9</span>
                        <span className="ml-1 text-sm font-medium text-gray-500">/ month</span>
                    </div>
                    <ul className="mt-8 space-y-4 flex-1">
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            20 Total Downloads
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Full 4K Quality Support
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Unlimited Trimming
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            MP3/WAV/FLAC Conversion
                        </li>
                    </ul>
                    <Link href={`/${locale}/auth#signup`}
                        className="mt-8 flex h-12 w-full items-center justify-center rounded-full border-2 border-primary/20 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-white">
                        Upgrade
                    </Link>
                </div>
                <div className="glass-panel relative flex flex-col rounded-3xl p-8 shadow-2xl ring-2 ring-primary">
                    <div
                        className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                        Best Value
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ultimate</h3>
                    <div className="mt-4 flex items-baseline">
                        <span className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">$19</span>
                        <span className="ml-1 text-sm font-medium text-gray-500">/ month</span>
                    </div>
                    <ul className="mt-8 space-y-4 flex-1">
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Unlimited Everything
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Batch Video Processing
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Ultra-fast Cloud Processing
                        </li>
                        <li className="flex items-center gap-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                            Priority Support
                        </li>
                    </ul>
                    <Link href={`/${locale}/auth#signup`}
                        className="mt-8 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-white transition-transform hover:scale-105">
                        Upgrade
                    </Link>
                </div>
            </div>
        </div>
    </section>
  )
}
