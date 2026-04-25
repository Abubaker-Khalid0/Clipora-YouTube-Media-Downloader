import Link from 'next/link'

export function HeroSection({ locale }: { locale: string }) {

  return (
    <section
        className="relative flex min-h-[calc(100vh-80px)] w-full flex-col items-center justify-center overflow-hidden py-20">
        <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-cover bg-center opacity-30 dark:opacity-20 blur-xl scale-110"
                style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCbf9MWbVRgY-FlLxnVPmnWgw6-kR2INSPh5ckSk6tJOCIm07Ss58yhyKrjWL8xRXM9Avl5ebUJTtTtTfUrRPSXXD5aWqFvsIFdhXm_YugQ8UD1Rkm7FxjqXRes0q5xtBxgseaM0bL-cb_-VUTkYMd1HE2IHyNcK4QPbzI7QFsUCibrZO1e6Q308MSVx0pi3PP8jJoHvOIst71QSp8Qdq6q_Sa_2CGmoHaeNNYtJ3rT3I9Y95FYowZaJnvk0q_TxfYdg8pWlF_cLR6P')" }}>
            </div>
            <div
                className="absolute inset-0 bg-gradient-to-b from-background-light/80 via-background-light/40 to-background-light dark:from-background-dark/80 dark:via-background-dark/40 dark:to-background-dark">
            </div>
        </div>
        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
                <div
                    className="glass-panel flex flex-col items-center rounded-3xl p-8 text-center shadow-2xl shadow-primary/5 sm:p-12 lg:p-16">
                    <div
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary dark:border-primary/30 dark:text-primary">
                        <span className="relative flex h-2 w-2">
                            <span
                                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                        </span>
                        TRY FOR FREE - NO CREDIT CARD REQUIRED
                    </div>
                    <h1
                        className="mb-6 text-4xl font-black leading-tight tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
                        More Than Just a <span className="text-primary">Downloader.</span>
                    </h1>
                    <p
                        className="mb-10 max-w-2xl text-lg font-medium leading-relaxed text-gray-600 dark:text-gray-300 sm:text-xl">
                        Download, Trim, and Convert. Get started with our basic tools for free and upgrade when you&apos;re
                        ready for more power.
                    </p>
                    <div className="flex w-full flex-col items-center">
                        <Link href={`/${locale}/auth#signup`}
                            className="flex h-16 min-w-[280px] items-center justify-center gap-3 rounded-full bg-primary px-10 text-lg font-bold text-white shadow-xl shadow-primary/30 transition-all hover:bg-red-600 hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                            <span>Start Your Free Trial</span>
                            <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    </section>
  )
}
