
export function HowItWorks() {

    return (
        <section className="relative py-24 w-full overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="hero-pattern h-full w-full"></div>
            </div>
            <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-16 text-center">
                    <h2 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">How
                        it works</h2>
                    <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">Transform your video workflow in
                        four simple steps.</p>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                    <div className="group relative flex flex-col items-center text-center">
                        <div
                            className="glass-panel relative mb-8 flex h-24 w-24 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-110">
                            <span className="material-symbols-outlined text-[48px] text-primary">person_add</span>
                            <div
                                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md">
                                1</div>
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Create Account</h3>
                        <p className="text-base text-gray-600 dark:text-gray-400 px-4">Sign up in seconds to unlock your initial
                            free operations.</p>
                        <div className="absolute right-[-15%] top-10 hidden w-full lg:block">
                            <span
                                className="material-symbols-outlined text-3xl text-gray-200 dark:text-white/10">trending_flat</span>
                        </div>
                    </div>
                    <div className="group relative flex flex-col items-center text-center">
                        <div
                            className="glass-panel relative mb-8 flex h-24 w-24 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-110">
                            <span className="material-symbols-outlined text-[48px] text-primary">search</span>
                            <div
                                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md">
                                2</div>
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Analyze Video</h3>
                        <p className="text-base text-gray-600 dark:text-gray-400 px-4">Paste your YouTube link and our engine
                            will extract all available metadata.</p>
                        <div className="absolute right-[-15%] top-10 hidden w-full lg:block">
                            <span
                                className="material-symbols-outlined text-3xl text-gray-200 dark:text-white/10">trending_flat</span>
                        </div>
                    </div>
                    <div className="group relative flex flex-col items-center text-center">
                        <div
                            className="glass-panel relative mb-8 flex h-24 w-24 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-110">
                            <span className="material-symbols-outlined text-[48px] text-primary">link</span>
                            <div
                                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md">
                                3</div>
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Choose &amp; Edit</h3>
                        <p className="text-base text-gray-600 dark:text-gray-400 px-4">Select your preferred quality, trim
                            segments, or convert formats instantly.</p>
                        <div className="absolute right-[-15%] top-10 hidden w-full lg:block">
                            <span
                                className="material-symbols-outlined text-3xl text-gray-200 dark:text-white/10">trending_flat</span>
                        </div>
                    </div>
                    <div className="group relative flex flex-col items-center text-center">
                        <div
                            className="glass-panel relative mb-8 flex h-24 w-24 items-center justify-center rounded-full shadow-xl transition-transform group-hover:scale-110">
                            <span className="material-symbols-outlined text-[48px] text-primary">download</span>
                            <div
                                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-md">
                                4</div>
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">Download Instantly</h3>
                        <p className="text-base text-gray-600 dark:text-gray-400 px-4">Save your processed media directly to
                            your device with lightning speed.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
