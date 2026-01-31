/* ========================================
   MediaDownloader Landing Page Scripts
   ======================================== */

// Initialize AOS (Animate On Scroll)
document.addEventListener('DOMContentLoaded', function() {
    // Initialize AOS
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 600,
            easing: 'ease-out',
            once: true,
            offset: 100
        });
    }
    
    console.log('MediaDownloader Landing Page Loaded');
});

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar Scroll Effect
let lastScroll = 0;
const navbar = document.querySelector('nav');

if (navbar) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        lastScroll = currentScroll;
    });
}

// Counter Animation
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start);
        }
    }, 16);
}

// Intersection Observer for Counter Animation
const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counter = entry.target;
            const target = parseInt(counter.getAttribute('data-target'));
            animateCounter(counter, target);
            observer.unobserve(counter);
        }
    });
}, observerOptions);

// Observe all counters
document.querySelectorAll('[data-counter]').forEach(counter => {
    observer.observe(counter);
});

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('[data-mobile-menu-btn]');
const mobileMenu = document.querySelector('[data-mobile-menu]');

if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        document.body.classList.toggle('menu-open');
    });
    
    // Close menu when clicking on a link
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            document.body.classList.remove('menu-open');
        });
    });
}

// FAQ Accordion
document.querySelectorAll('[data-faq-question]').forEach(question => {
    question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const icon = question.querySelector('svg');
        
        // Close other FAQs
        document.querySelectorAll('[data-faq-answer]').forEach(otherAnswer => {
            if (otherAnswer !== answer) {
                otherAnswer.classList.add('hidden');
                const otherIcon = otherAnswer.previousElementSibling.querySelector('svg');
                if (otherIcon) {
                    otherIcon.style.transform = 'rotate(0deg)';
                }
            }
        });
        
        // Toggle current FAQ
        answer.classList.toggle('hidden');
        if (icon) {
            icon.style.transform = answer.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });
});

// Utility Functions
const utils = {
    // Format number with commas
    formatNumber: (num) => {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },
    
    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Check if element is in viewport
    isInViewport: (element) => {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

// Export utils for use in other scripts
window.landingUtils = utils;


/* ========================================
   Download Functionality (YouTube Only)
   ======================================== */

// Global State
let currentMode = 'video_audio';
let currentQuality = 'best_available';
let pollingInterval = null;

// Mode Selection
function selectMode(mode) {
    currentMode = mode;
    
    // Update mode cards
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected', 'border-primary-500', 'border-purple-500', 'border-emerald-500', 'border-orange-500', 'glow-blue', 'glow-purple', 'glow-green');
        card.classList.add('border-transparent');
        const checkmark = card.querySelector('.mode-check');
        if (checkmark) {
            checkmark.classList.add('hidden');
            checkmark.classList.remove('flex');
        }
    });
    
    const selectedCard = event.currentTarget;
    selectedCard.classList.add('selected');
    selectedCard.classList.remove('border-transparent');
    
    const checkmark = selectedCard.querySelector('.mode-check');
    if (checkmark) {
        checkmark.classList.remove('hidden');
        checkmark.classList.add('flex');
    }
    
    // Apply mode-specific styling
    if (mode === 'video_audio') {
        selectedCard.classList.add('border-primary-500', 'glow-blue');
    } else if (mode === 'video_only') {
        selectedCard.classList.add('border-purple-500', 'glow-purple');
    } else if (mode === 'audio_only') {
        selectedCard.classList.add('border-emerald-500', 'glow-green');
    } else if (mode === 'thumbnail') {
        selectedCard.classList.add('border-orange-500');
    }
    
    // Show/hide quality options
    const showQuality = mode === 'video_audio' || mode === 'video_only';
    const qualityOptions = document.getElementById('quality-options');
    if (qualityOptions) qualityOptions.classList.toggle('hidden', !showQuality);
    
    // Show/hide trim section
    const showTrim = mode === 'video_audio' || mode === 'video_only';
    const trimSection = document.getElementById('trim-section');
    if (trimSection) trimSection.classList.toggle('hidden', !showTrim);
}

// Quality Selection
function selectQuality(quality) {
    currentQuality = quality;
    
    document.querySelectorAll('.quality-card').forEach(card => {
        card.classList.remove('selected', 'border-emerald-500', 'border-primary-500', 'glow-green', 'glow-blue');
        card.classList.add('border-transparent');
        const checkmark = card.querySelector('.quality-check');
        if (checkmark) {
            checkmark.classList.add('hidden');
            checkmark.classList.remove('flex');
        }
    });
    
    const selectedCard = event.currentTarget;
    selectedCard.classList.add('selected');
    selectedCard.classList.remove('border-transparent');
    
    const checkmark = selectedCard.querySelector('.quality-check');
    if (checkmark) {
        checkmark.classList.remove('hidden');
        checkmark.classList.add('flex');
    }
    
    if (quality === 'best_available') {
        selectedCard.classList.add('border-emerald-500', 'glow-green');
    } else {
        selectedCard.classList.add('border-primary-500', 'glow-blue');
    }
}

// Trim Toggle
function toggleTrim() {
    const trimInputs = document.getElementById('trim-inputs');
    const isChecked = document.getElementById('trim-toggle')?.checked;
    if (trimInputs) trimInputs.classList.toggle('hidden', !isChecked);
}

// Utility Functions
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    
    if (!toast || !toastMessage || !toastIcon) return;
    
    toastMessage.textContent = message;
    
    if (type === 'success') {
        toast.className = 'fixed top-6 left-6 px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white';
        toastIcon.textContent = '✅';
    } else {
        toast.className = 'fixed top-6 left-6 px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 bg-gradient-to-r from-red-500 to-rose-600 text-white';
        toastIcon.textContent = '❌';
    }
    
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

function formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Functions
async function startDownload() {
    const url = document.getElementById('video-url')?.value.trim();
    const btn = document.getElementById('download-btn');
    const btnText = document.getElementById('btn-text');
    const btnIcon = document.getElementById('btn-icon');
    
    if (!url) {
        showToast('الرجاء إدخال رابط الفيديو', 'error');
        return;
    }

    // Get trim values if enabled
    const trimEnabled = document.getElementById('trim-toggle')?.checked;
    const startTime = document.getElementById('start-time')?.value.trim();
    const endTime = document.getElementById('end-time')?.value.trim();

    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'جاري البدء...';
    if (btnIcon) btnIcon.innerHTML = '<div class="animate-spin">⏳</div>';

    try {
        const payload = {
            url: url,
            mode: currentMode,
            quality_preference: currentQuality
        };

        if (trimEnabled && startTime && endTime) {
            payload.trim = true;
            payload.start_time = startTime;
            payload.end_time = endTime;
        }

        const response = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            showToast('بدأ التحميل بنجاح!', 'success');
            const urlInput = document.getElementById('video-url');
            if (urlInput) urlInput.value = '';
            refreshJobs();
        } else if (response.status === 409) {
            showToast('يوجد تحميل قيد التنفيذ، الرجاء الانتظار', 'error');
        } else {
            showToast(data.error || 'حدث خطأ', 'error');
        }
    } catch (error) {
        showToast('خطأ في الاتصال', 'error');
    } finally {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'ابدأ التحميل';
        if (btnIcon) btnIcon.textContent = '🚀';
        refreshJobs();
    }
}

async function refreshJobs() {
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();

        if (response.ok) {
            const successCount = data.jobs.filter(j => j.status === 'success').length;
            const jobsCount = document.getElementById('jobs-count');
            if (jobsCount) jobsCount.textContent = `${successCount} / ${data.total} مكتمل`;
            
            const isDownloading = data.is_downloading;
            const downloadBtn = document.getElementById('download-btn');
            const btnText = document.getElementById('btn-text');
            const btnIcon = document.getElementById('btn-icon');
            
            if (isDownloading) {
                if (downloadBtn) downloadBtn.disabled = true;
                if (btnText) btnText.textContent = 'جاري التحميل...';
                if (btnIcon) btnIcon.innerHTML = '<div class="animate-spin">⏳</div>';
            } else {
                if (downloadBtn) downloadBtn.disabled = false;
                if (btnText) btnText.textContent = 'ابدأ التحميل';
                if (btnIcon) btnIcon.textContent = '🚀';
            }
            
            renderJobs(data.jobs);
        }
    } catch (error) {
        console.error('Error fetching jobs:', error);
    }
}

async function deleteJob(jobId) {
    if (!confirm('حذف هذا التحميل؟')) return;

    try {
        const response = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('تم الحذف بنجاح', 'success');
            refreshJobs();
        }
    } catch (error) {
        showToast('فشل الحذف', 'error');
    }
}

async function openFolder(jobId) {
    try {
        const response = await fetch(`/api/files/open-folder/${jobId}`, { method: 'POST' });
        if (response.ok) {
            showToast('تم فتح المجلد', 'success');
        } else {
            showToast('فشل فتح المجلد', 'error');
        }
    } catch (error) {
        showToast('فشل فتح المجلد', 'error');
    }
}

function renderJobs(jobs) {
    const container = document.getElementById('jobs-container');
    if (!container) return;

    if (!jobs || jobs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="w-20 h-20 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                    <span class="text-4xl opacity-50">📭</span>
                </div>
                <p class="text-dark-400">لا توجد تحميلات بعد</p>
                <p class="text-sm text-dark-500 mt-1">الصق رابط فيديو أعلاه للبدء</p>
            </div>
        `;
        return;
    }

    container.innerHTML = jobs.map(job => `
        <div class="glass-card rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-all">
            <div class="flex items-stretch">
                <!-- Thumbnail -->
                <div class="relative w-32 h-28 flex-shrink-0">
                    ${job.video_id ? `
                        <img 
                            src="https://img.youtube.com/vi/${job.video_id}/mqdefault.jpg" 
                            alt="Thumbnail" 
                            class="w-full h-full object-cover"
                            onerror="this.src='https://img.youtube.com/vi/${job.video_id}/default.jpg'"
                        >
                    ` : `
                        <div class="w-full h-full bg-dark-800 flex items-center justify-center">
                            <span class="text-2xl opacity-30">🎬</span>
                        </div>
                    `}
                    
                    <!-- Progress Overlay -->
                    <div class="absolute inset-0 flex items-center justify-center bg-black/60">
                        ${job.status === 'running' ? `
                            <div class="relative w-16 h-16">
                                <svg class="w-16 h-16 transform -rotate-90">
                                    <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.2)" stroke-width="4" fill="none"/>
                                    <circle cx="32" cy="32" r="28" stroke="#3b82f6" stroke-width="4" fill="none" 
                                        stroke-dasharray="${2 * Math.PI * 28}" 
                                        stroke-dashoffset="${2 * Math.PI * 28 * (1 - job.progress / 100)}"
                                        stroke-linecap="round" class="progress-ring"/>
                                </svg>
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <span class="text-white font-bold text-sm">${job.progress}%</span>
                                </div>
                            </div>
                        ` : job.status === 'success' ? `
                            <div class="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                            </div>
                        ` : `
                            <div class="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                                </svg>
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Content -->
                <div class="flex-1 p-4 flex flex-col justify-between">
                    <div>
                        <h3 class="font-bold text-white text-sm mb-2 line-clamp-1">${escapeHtml(job.video_title || 'جاري التحميل...')}</h3>
                        <div class="text-xs text-dark-400">
                            ${job.status === 'running' ? `
                                <span class="text-primary-400">جاري التحميل...</span>
                            ` : job.status === 'success' ? `
                                <span class="text-emerald-400">مكتمل</span> • ${formatBytes(job.file_size)}
                            ` : `
                                <span class="text-red-400">فشل</span>
                            `}
                        </div>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="flex items-center gap-2 p-4 border-r border-white/5">
                    ${job.status === 'success' ? `
                        <a href="/api/files/download/${job.id}" class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 rounded-xl flex items-center justify-center transition-all" title="تحميل">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                        </a>
                        <button onclick="openFolder('${job.id}')" class="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all" title="فتح المجلد">
                            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button onclick="deleteJob('${job.id}')" class="w-10 h-10 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-all group" title="حذف">
                        <svg class="w-5 h-5 text-dark-400 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </div>
            
            ${job.status === 'failed' && job.error_message ? `
                <div class="px-4 pb-4">
                    <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p class="text-xs text-red-400">⚠️ ${escapeHtml(job.error_message)}</p>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Initialize download functionality
document.addEventListener('DOMContentLoaded', function() {
    // Start polling for jobs if on landing page with download section
    if (document.getElementById('jobs-container')) {
        refreshJobs();
        pollingInterval = setInterval(refreshJobs, 2000);
    }
    
    // Add enter key listener for URL input
    const urlInput = document.getElementById('video-url');
    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startDownload();
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (pollingInterval) clearInterval(pollingInterval);
});

// Export functions to global scope
window.selectMode = selectMode;
window.selectQuality = selectQuality;
window.toggleTrim = toggleTrim;
window.startDownload = startDownload;
window.refreshJobs = refreshJobs;
window.deleteJob = deleteJob;
window.openFolder = openFolder;
