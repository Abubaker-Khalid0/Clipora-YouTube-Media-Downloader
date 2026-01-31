/**
 * Dashboard.js - MediaDownloader Dashboard Logic
 * Handles URL analysis, UI state management, and video processing
 */

// ========================================
// Global State
// ========================================
let currentMode = 'video'; // 'video' | 'audio_only' | 'thumbnail'
let currentVideoData = null;
let currentJobId = null;
let progressInterval = null;
let ytPlayer = null;
let isTrimEnabled = false;

// ========================================
// DOM Elements
// ========================================
const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzeBtnText = document.getElementById('analyzeBtnText');
const analyzeBtnSpinner = document.getElementById('analyzeBtnSpinner');

const stateEmpty = document.getElementById('state-empty');
const stateReady = document.getElementById('state-ready');

const videoTitle = document.getElementById('videoTitle');
const videoDuration = document.getElementById('videoDuration');
const videoChannel = document.getElementById('videoChannel');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoPreviewCard = document.getElementById('videoPreviewCard');
const youtubePlayerContainer = document.getElementById('youtubePlayerContainer');

const videoTypeSelect = document.getElementById('videoTypeSelect');
const qualitySelect = document.getElementById('qualitySelect');
const trimToggle = document.getElementById('trimToggle');

const startTimeInput = document.getElementById('startTimeInput');
const endTimeInput = document.getElementById('endTimeInput');
const setStartBtn = document.getElementById('setStartBtn');
const setEndBtn = document.getElementById('setEndBtn');
const resetTrimBtn = document.getElementById('resetTrimBtn');

const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');

const videoModeContent = document.getElementById('videoModeContent');
const audioModeContent = document.getElementById('audioModeContent');
const thumbnailModeContent = document.getElementById('thumbnailModeContent');
const trimSegmentSection = document.getElementById('trimSegmentSection');

const formatJPG = document.getElementById('formatJPG');
const formatPNG = document.getElementById('formatPNG');

const startProcessingBtn = document.getElementById('startProcessingBtn');

// ========================================
// Utility Functions
// ========================================

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeForInput(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
        return `${mb.toFixed(1)} MB`;
    }
    return `${(mb / 1024).toFixed(1)} GB`;
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

// ========================================
// UI State Management
// ========================================

function setAnalyzeLoading(isLoading) {
    if (isLoading) {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.add('opacity-70', 'cursor-not-allowed');
        analyzeBtnText.textContent = 'Analyzing...';
        analyzeBtnSpinner.classList.remove('hidden');
    } else {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('opacity-70', 'cursor-not-allowed');
        analyzeBtnText.textContent = 'Analyze';
        analyzeBtnSpinner.classList.add('hidden');
    }
}

function showReadyState() {
    stateEmpty.classList.add('hidden');
    stateReady.classList.remove('hidden');
    stateReady.style.display = 'grid';
}

function showEmptyState() {
    stateReady.classList.add('hidden');
    stateReady.style.display = '';
    stateEmpty.classList.remove('hidden');
}

function showErrorModal(message) {
    errorMessage.textContent = message || 'An error occurred. Please try again.';
    errorModal.classList.remove('hidden');
}

function closeErrorModal() {
    errorModal.classList.add('hidden');
}

function showLimitModal() {
    const limitModal = document.getElementById('limitModal');
    if (limitModal) {
        limitModal.classList.remove('hidden');
    }
}

function closeLimitModal() {
    const limitModal = document.getElementById('limitModal');
    if (limitModal) {
        limitModal.classList.add('hidden');
    }
}

// ========================================
// Mode Switching
// ========================================

function switchToVideoMode() {
    currentMode = 'video';
    
    // Update UI
    videoModeContent.classList.remove('hidden');
    audioModeContent.classList.add('hidden');
    thumbnailModeContent.classList.add('hidden');
    
    // Show trim section if trim is enabled
    if (isTrimEnabled) {
        trimSegmentSection.classList.remove('hidden');
    }
    
    // Update all mode buttons
    updateModeButtons();
}

function switchToAudioMode() {
    currentMode = 'audio_only';
    
    // Update UI
    videoModeContent.classList.add('hidden');
    audioModeContent.classList.remove('hidden');
    thumbnailModeContent.classList.add('hidden');
    trimSegmentSection.classList.add('hidden');
    
    // Destroy player if exists
    destroyYouTubePlayer();
    
    // Update all mode buttons
    updateModeButtons();
}

function switchToThumbnailMode() {
    currentMode = 'thumbnail';
    
    // Update UI
    videoModeContent.classList.add('hidden');
    audioModeContent.classList.add('hidden');
    thumbnailModeContent.classList.remove('hidden');
    trimSegmentSection.classList.add('hidden');
    
    // Destroy player if exists
    destroyYouTubePlayer();
    
    // Update all mode buttons
    updateModeButtons();
}

function updateModeButtons() {
    // Get all mode buttons
    const allModeButtons = [
        document.getElementById('modeVideo'),
        document.getElementById('modeAudio'),
        document.getElementById('modeThumbnail'),
        document.getElementById('modeVideoAudio'),
        document.getElementById('modeAudioAudio'),
        document.getElementById('modeThumbnailAudio'),
        document.getElementById('modeVideoThumb'),
        document.getElementById('modeAudioThumb'),
        document.getElementById('modeThumbnailThumb')
    ];
    
    allModeButtons.forEach(btn => {
        if (!btn) return;
        
        const isVideo = btn.id.includes('Video') && !btn.id.includes('Audio');
        const isAudio = btn.id.includes('Audio') && !btn.id.includes('Video');
        const isThumbnail = btn.id.includes('Thumbnail');
        
        const isActive = (currentMode === 'video' && isVideo) ||
                        (currentMode === 'audio_only' && isAudio) ||
                        (currentMode === 'thumbnail' && isThumbnail);
        
        if (isActive) {
            btn.classList.remove('inactive');
            btn.classList.add('active');
            // Add checkmark if not present
            if (!btn.querySelector('.material-symbols-outlined')) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined text-green-500 text-[18px]';
                icon.textContent = 'check_circle';
                btn.insertBefore(icon, btn.firstChild);
            }
        } else {
            btn.classList.remove('active');
            btn.classList.add('inactive');
            // Remove checkmark
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) icon.remove();
        }
    });
}

// ========================================
// Thumbnail Format Switching
// ========================================

function switchToJPG() {
    if (formatJPG) {
        formatJPG.classList.add('bg-white', 'shadow-sm', 'border', 'border-slate-200', 'text-slate-900');
        formatJPG.classList.remove('text-slate-500');
    }
    if (formatPNG) {
        formatPNG.classList.remove('bg-white', 'shadow-sm', 'border', 'border-slate-200', 'text-slate-900');
        formatPNG.classList.add('text-slate-500');
    }
}

function switchToPNG() {
    if (formatPNG) {
        formatPNG.classList.add('bg-white', 'shadow-sm', 'border', 'border-slate-200', 'text-slate-900');
        formatPNG.classList.remove('text-slate-500');
    }
    if (formatJPG) {
        formatJPG.classList.remove('bg-white', 'shadow-sm', 'border', 'border-slate-200', 'text-slate-900');
        formatJPG.classList.add('text-slate-500');
    }
}

// ========================================
// YouTube Player Management
// ========================================

function initYouTubePlayer(videoId) {
    if (!window.YT || !window.YT.Player) {
        console.error('YouTube IFrame API not loaded');
        return;
    }
    
    // Destroy existing player
    destroyYouTubePlayer();
    
    // Show player container, hide thumbnail
    youtubePlayerContainer.classList.remove('hidden');
    videoThumbnail.classList.add('hidden');
    
    // Create player
    ytPlayer = new YT.Player('youtubePlayerContainer', {
        videoId: videoId,
        width: '100%',
        height: '100%',
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    // Enable Set Start/End buttons
    if (setStartBtn) setStartBtn.disabled = false;
    if (setEndBtn) setEndBtn.disabled = false;
}

function destroyYouTubePlayer() {
    if (ytPlayer) {
        ytPlayer.destroy();
        ytPlayer = null;
    }
    
    // Hide player container, show thumbnail
    if (youtubePlayerContainer) youtubePlayerContainer.classList.add('hidden');
    if (videoThumbnail) videoThumbnail.classList.remove('hidden');
    
    // Disable Set Start/End buttons
    if (setStartBtn) setStartBtn.disabled = true;
    if (setEndBtn) setEndBtn.disabled = true;
}

// ========================================
// Trim Management
// ========================================

function handleTrimToggle() {
    isTrimEnabled = trimToggle.checked;
    
    if (isTrimEnabled) {
        // Show trim section
        trimSegmentSection.classList.remove('hidden');
        
        // Reset times to 00:00:00
        startTimeInput.value = '00:00:00';
        endTimeInput.value = '00:00:00';
        
        // Initialize YouTube player if we have video data
        if (currentVideoData && currentVideoData.video_id) {
            initYouTubePlayer(currentVideoData.video_id);
        }
    } else {
        // Hide trim section
        trimSegmentSection.classList.add('hidden');
        
        // Destroy player
        destroyYouTubePlayer();
    }
}

function handleResetTrim() {
    startTimeInput.value = '00:00:00';
    endTimeInput.value = '00:00:00';
}

function handleSetStart() {
    if (ytPlayer && ytPlayer.getCurrentTime) {
        const currentTime = Math.floor(ytPlayer.getCurrentTime());
        startTimeInput.value = formatTimeForInput(currentTime);
    }
}

function handleSetEnd() {
    if (ytPlayer && ytPlayer.getCurrentTime) {
        const currentTime = Math.floor(ytPlayer.getCurrentTime());
        endTimeInput.value = formatTimeForInput(currentTime);
    }
}

// ========================================
// API Functions
// ========================================

async function analyzeVideo() {
    const url = urlInput.value.trim();
    
    if (!url) {
        showErrorModal('Please enter a YouTube URL');
        return;
    }
    
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        showErrorModal('Please enter a valid YouTube URL');
        return;
    }
    
    setAnalyzeLoading(true);
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to analyze video');
        }
        
        // Store video data
        currentVideoData = data;
        
        // Populate UI with video data
        populateVideoData(data);
        
        // Switch to ready state
        showReadyState();
        
    } catch (error) {
        console.error('Analysis error:', error);
        showErrorModal(error.message);
    } finally {
        setAnalyzeLoading(false);
    }
}

function populateVideoData(data) {
    // Set video info
    videoTitle.textContent = data.title || 'Unknown Title';
    videoDuration.textContent = formatTime(data.duration_seconds) || '0:00';
    videoChannel.textContent = data.channel || 'Unknown Channel';
    
    // Set thumbnail
    if (data.thumbnail_url) {
        videoThumbnail.src = data.thumbnail_url;
    }
    
    // Set trim inputs
    if (data.duration_seconds) {
        startTimeInput.value = '00:00:00';
        endTimeInput.value = '00:00:00';
        
        // Update timeline markers
        const quarter1 = Math.floor(data.duration_seconds / 3);
        const quarter2 = Math.floor((data.duration_seconds * 2) / 3);
        
        const trimQuarter1 = document.getElementById('trimQuarter1');
        const trimQuarter2 = document.getElementById('trimQuarter2');
        const trimEnd = document.getElementById('trimEnd');
        
        if (trimQuarter1) trimQuarter1.textContent = formatTime(quarter1);
        if (trimQuarter2) trimQuarter2.textContent = formatTime(quarter2);
        if (trimEnd) trimEnd.textContent = formatTime(data.duration_seconds);
    }
    
    // Populate quality dropdown with available_qualities array
    if (data.available_qualities && data.available_qualities.length > 0 && qualitySelect) {
        qualitySelect.innerHTML = '';
        qualitySelect.disabled = false;
        
        // Add "Best" option
        const bestOption = document.createElement('option');
        bestOption.value = 'best';
        bestOption.textContent = 'Best Available';
        qualitySelect.appendChild(bestOption);
        
        // Add quality options from available_qualities
        data.available_qualities.forEach((height) => {
            const option = document.createElement('option');
            option.value = height;
            option.textContent = `${height}p`;
            qualitySelect.appendChild(option);
        });
    }
    
    // Update audio mode info if available
    if (data.best_audio_label) {
        const audioDetected = document.getElementById('audioDetected');
        if (audioDetected) {
            audioDetected.textContent = `Detected: ${data.best_audio_label}`;
        }
    }
}

async function startProcessing() {
    if (!currentVideoData) {
        showErrorModal('Please analyze a video first');
        return;
    }
    
    // Build request payload based on current mode
    const payload = {
        url: urlInput.value.trim(),
        mode: currentMode
    };
    
    // Add mode-specific parameters
    if (currentMode === 'video') {
        payload.video_type = videoTypeSelect.value;
        payload.quality = qualitySelect.value;
        payload.trim = isTrimEnabled;
        
        if (isTrimEnabled) {
            const endTime = endTimeInput.value;
            
            // Check if end time is still 00:00:00
            if (endTime === '00:00:00') {
                showErrorModal('Please set an end time.');
                return;
            }
            
            payload.start_time = startTimeInput.value;
            payload.end_time = endTime;
        }
    } else if (currentMode === 'thumbnail') {
        // Get selected thumbnail format
        const isJPG = formatJPG && formatJPG.classList.contains('bg-white');
        payload.thumbnail_format = isJPG ? 'jpg' : 'png';
    }
    // audio_only mode needs no extra fields
    
    try {
        startProcessingBtn.disabled = true;
        startProcessingBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Starting...';
        
        const response = await fetch('/api/jobs/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to start processing');
        }
        
        // Start polling for progress
        startProgressPolling(data.job_id);
        
    } catch (error) {
        console.error('Processing error:', error);
        showErrorModal(error.message);
        resetProcessingButton();
    }
}

// ========================================
// Progress Tracking
// ========================================

async function pollJobStatus(jobId) {
    try {
        const response = await fetch(`/api/jobs/${jobId}`);
        const job = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to fetch job status');
        }
        
        updateProgressUI(job);
        
        // Stop polling if job is complete or failed
        if (job.status === 'success' || job.status === 'failed') {
            stopProgressPolling();
            
            if (job.status === 'success') {
                showDownloadReady(job);
            } else {
                showErrorModal(job.error_message || 'Download failed');
                resetProcessingButton();
            }
            
            // Refresh recent activity
            loadRecentActivity();
        }
        
    } catch (error) {
        console.error('Polling error:', error);
        stopProgressPolling();
        showErrorModal('Failed to track progress');
        resetProcessingButton();
    }
}

function startProgressPolling(jobId) {
    currentJobId = jobId;
    progressInterval = setInterval(() => pollJobStatus(jobId), 1000);
    pollJobStatus(jobId);
}

function stopProgressPolling() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function updateProgressUI(job) {
    const btn = startProcessingBtn;
    if (!btn) return;
    
    const statusText = {
        'initializing': 'Initializing...',
        'extracting_info': 'Analyzing video...',
        'downloading': `Downloading... ${job.progress}%`,
        'downloading_thumbnail': 'Downloading thumbnail...',
        'converting_thumbnail': 'Converting thumbnail...',
        'merging': 'Merging video and audio...',
        'trimming': 'Trimming video...',
        'preparing_trim': 'Preparing to trim...',
        'processing': 'Processing...',
        'finalizing': 'Finalizing...',
        'completed': 'Completed!',
        'failed': 'Failed'
    };
    
    const text = statusText[job.stage] || `Processing... ${job.progress}%`;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> ${text}`;
}

function showDownloadReady(job) {
    const btn = startProcessingBtn;
    if (!btn) return;
    
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined text-green-500">download</span> Download Ready`;
    btn.onclick = () => downloadFile(job.id);
}

function downloadFile(jobId) {
    window.location.href = `/api/files/download/${jobId}`;
}

function resetProcessingButton() {
    const btn = startProcessingBtn;
    if (!btn) return;
    
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined group-hover:rotate-12 transition-transform">bolt</span> START PROCESSING';
    btn.onclick = startProcessing;
}

// ========================================
// Recent Activity
// ========================================

async function loadRecentActivity() {
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to load activity');
        }
        
        displayRecentActivity(data.jobs);
        
    } catch (error) {
        console.error('Failed to load recent activity:', error);
    }
}

function displayRecentActivity(jobs) {
    const container = document.getElementById('activityContainer');
    if (!container) return;
    
    const completedJobs = jobs.filter(j => j.status === 'success').slice(0, 5);
    
    if (completedJobs.length === 0) {
        return;
    }
    
    const activityHTML = completedJobs.map(job => `
        <div class="glass-card rounded-2xl p-6 flex items-center justify-between hover:shadow-lg transition-shadow">
            <div class="flex items-center gap-4 flex-1">
                <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-2xl">
                        ${job.mode === 'audio_only' ? 'audio_file' : job.mode === 'thumbnail' ? 'image' : 'video_file'}
                    </span>
                </div>
                <div class="flex-1">
                    <h4 class="font-bold text-slate-900 mb-1">${job.video_title || 'Unknown'}</h4>
                    <div class="flex items-center gap-3 text-xs text-slate-500">
                        <span>${job.final_ext || 'N/A'}</span>
                        <span>•</span>
                        <span>${formatFileSize(job.file_size)}</span>
                        <span>•</span>
                        <span>${formatDate(job.finished_at)}</span>
                    </div>
                </div>
            </div>
            <button onclick="downloadFile('${job.id}')" 
                class="flex items-center gap-2 bg-primary hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-colors">
                <span class="material-symbols-outlined text-xl">download</span>
                Download
            </button>
        </div>
    `).join('');
    
    container.className = 'space-y-4';
    container.innerHTML = activityHTML;
}

// ========================================
// Event Listeners
// ========================================

// Analyze button
analyzeBtn.addEventListener('click', analyzeVideo);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        analyzeVideo();
    }
});

// Mode switching buttons
document.getElementById('modeVideo')?.addEventListener('click', switchToVideoMode);
document.getElementById('modeAudio')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeThumbnail')?.addEventListener('click', switchToThumbnailMode);
document.getElementById('modeVideoAudio')?.addEventListener('click', switchToVideoMode);
document.getElementById('modeAudioAudio')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeThumbnailAudio')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeVideoThumb')?.addEventListener('click', switchToVideoMode);
document.getElementById('modeAudioThumb')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeThumbnailThumb')?.addEventListener('click', switchToThumbnailMode);

// Thumbnail format buttons
formatJPG?.addEventListener('click', switchToJPG);
formatPNG?.addEventListener('click', switchToPNG);

// Trim controls
trimToggle?.addEventListener('change', handleTrimToggle);
resetTrimBtn?.addEventListener('click', handleResetTrim);
setStartBtn?.addEventListener('click', handleSetStart);
setEndBtn?.addEventListener('click', handleSetEnd);

// Start processing button
startProcessingBtn?.addEventListener('click', startProcessing);

// ========================================
// Initialize
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Set initial mode to video
    switchToVideoMode();
    
    // Load recent activity
    loadRecentActivity();
});

// Make functions available globally
window.downloadFile = downloadFile;
window.closeErrorModal = closeErrorModal;
window.closeLimitModal = closeLimitModal;
window.showLimitModal = showLimitModal;
