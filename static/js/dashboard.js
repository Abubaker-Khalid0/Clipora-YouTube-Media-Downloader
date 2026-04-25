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
let csrfToken = null; // CSRF token for protected requests

// Timeline drag state
let isDragging = false;
let activeHandle = null; // 'start' | 'end' | null

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

// Timeline elements
const timelineTrack = document.getElementById('timelineTrack');
const timelineSelection = document.getElementById('timelineSelection');
const startHandle = document.getElementById('startHandle');
const endHandle = document.getElementById('endHandle');

// ========================================
// CSRF Protection
// ========================================

async function fetchCSRFToken() {
    /**
     * Fetch a fresh CSRF token from the backend.
     * Should be called on page load and after each protected request.
     */
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        
        if (response.ok && data.csrf_token) {
            csrfToken = data.csrf_token;
            console.log('CSRF token refreshed');
            return true;
        } else {
            console.error('Failed to get CSRF token:', data);
            return false;
        }
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return false;
    }
}

async function fetchWithCSRF(url, options = {}) {
    /**
     * Wrapper around fetch() that automatically includes CSRF token.
     * Refreshes token after each protected request.
     * 
     * Usage:
     *   const response = await fetchWithCSRF('/api/endpoint', {
     *       method: 'POST',
     *       body: JSON.stringify(data)
     *   });
     */
    
    // Ensure we have a CSRF token for state-changing requests
    const method = options.method?.toUpperCase() || 'GET';
    const needsCSRF = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
    
    if (needsCSRF) {
        // If no token, fetch one first
        if (!csrfToken) {
            const success = await fetchCSRFToken();
            if (!success) {
                throw new Error('Failed to obtain CSRF token');
            }
        }
        
        // Add CSRF token to headers
        options.headers = {
            ...options.headers,
            'X-CSRF-Token': csrfToken
        };
    }
    
    // Make the request
    const response = await fetch(url, options);
    
    // If CSRF token was used, refresh it for next request
    if (needsCSRF && response.ok) {
        // Refresh token in background (don't wait)
        fetchCSRFToken().catch(err => console.error('Failed to refresh CSRF token:', err));
    }
    
    // Handle CSRF errors specifically
    if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        if (data.error && data.error.includes('CSRF')) {
            // CSRF token expired or invalid - refresh and suggest retry
            await fetchCSRFToken();
            throw new Error('Security token expired. Please try again.');
        }
    }
    
    return response;
}

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

function getVideoBitrate(height) {
    /**
     * Get estimated video bitrate in Mbps based on resolution height
     */
    const bitrateMap = {
        2160: 20,   // 4K
        1440: 12,   // 2K
        1080: 8,    // Full HD
        720: 5,     // HD
        480: 2.5,   // SD
        360: 1,     // Low
        240: 0.5,   // Very Low
        144: 0.3    // Minimum
    };
    return bitrateMap[height] || 5; // Default to 720p bitrate
}

function calculateEstimatedSize() {
    /**
     * Calculate and display estimated file size based on:
     * - Selected quality (resolution)
     * - Video duration
     * - Selected format
     * - Whether audio is included
     */
    const estimatedSizeEl = document.getElementById('estimatedSize');
    if (!estimatedSizeEl || !currentVideoData) {
        if (estimatedSizeEl) estimatedSizeEl.textContent = '-- MB';
        return;
    }
    
    const duration = currentVideoData.duration_seconds || 0;
    if (duration <= 0) {
        estimatedSizeEl.textContent = '-- MB';
        return;
    }
    
    let estimatedMB = 0;
    
    if (currentMode === 'video') {
        const quality = qualitySelect?.value || 'best';
        const videoType = videoTypeSelect?.value || 'video_audio';
        
        // Determine video bitrate in Mbps
        let videoBitrateMbps;
        if (quality === 'best') {
            const qualities = currentVideoData.available_qualities || [];
            const maxQuality = qualities.length > 0 ? Math.max(...qualities) : 1080;
            videoBitrateMbps = getVideoBitrate(maxQuality);
        } else {
            videoBitrateMbps = getVideoBitrate(parseInt(quality));
        }
        
        // Calculate video size: bitrate (Mbps) * duration (seconds) / 8 = MB
        const videoSizeMB = (videoBitrateMbps * duration) / 8;
        estimatedMB += videoSizeMB;
        
        // Add audio if video_audio mode
        if (videoType === 'video_audio') {
            const audioBitrateKbps = 160; // Standard audio bitrate
            const audioSizeMB = (audioBitrateKbps * duration) / 8000;
            estimatedMB += audioSizeMB;
        }
        
    } else if (currentMode === 'audio_only') {
        // Audio only mode
        const audioBitrateKbps = currentVideoData.best_audio_bitrate || 160;
        estimatedMB = (audioBitrateKbps * duration) / 8000;
        
    } else if (currentMode === 'thumbnail') {
        // Thumbnail: fixed estimate
        estimatedMB = 1; // ~1 MB typical
    }
    
    // Format output
    if (estimatedMB < 1) {
        estimatedSizeEl.textContent = `~${Math.round(estimatedMB * 1024)} KB`;
    } else if (estimatedMB >= 1000) {
        estimatedSizeEl.textContent = `~${(estimatedMB / 1024).toFixed(2)} GB`;
    } else {
        estimatedSizeEl.textContent = `~${estimatedMB.toFixed(1)} MB`;
    }
}

// Alias for backward compatibility
function updateEstimatedSize() {
    calculateEstimatedSize();
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
    calculateEstimatedSize();
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
    calculateEstimatedSize();
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
    calculateEstimatedSize();
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
        trimSegmentSection.classList.remove('hidden');
        
        startTimeInput.value = '00:00:00';
        endTimeInput.value = '00:00:00';
        
        if (currentVideoData && currentVideoData.video_id) {
            initYouTubePlayer(currentVideoData.video_id);
        }
        
        initTimeline();
    } else {
        trimSegmentSection.classList.add('hidden');
        destroyYouTubePlayer();
        destroyTimeline();
    }
}

function handleResetTrim() {
    startTimeInput.value = '00:00:00';
    endTimeInput.value = '00:00:00';
    updateTimelineFromInputs();
}

function handleSetStart() {
    if (ytPlayer && ytPlayer.getCurrentTime) {
        const currentTime = Math.floor(ytPlayer.getCurrentTime());
        startTimeInput.value = formatTimeForInput(currentTime);
        updateTimelineFromInputs();
    }
}

function handleSetEnd() {
    if (ytPlayer && ytPlayer.getCurrentTime) {
        const currentTime = Math.floor(ytPlayer.getCurrentTime());
        endTimeInput.value = formatTimeForInput(currentTime);
        updateTimelineFromInputs();
    }
}

// ========================================
// Timeline Drag Functionality
// ========================================

function parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0;
}

function initTimeline() {
    if (!timelineTrack || !startHandle || !endHandle || !timelineSelection) return;
    
    const duration = currentVideoData?.duration_seconds || 0;
    if (duration <= 0) {
        timelineTrack.style.opacity = '0.5';
        timelineTrack.style.pointerEvents = 'none';
        return;
    }
    
    timelineTrack.style.opacity = '1';
    timelineTrack.style.pointerEvents = 'auto';
    
    startHandle.style.left = '0%';
    endHandle.style.left = '100%';
    timelineSelection.style.left = '0%';
    timelineSelection.style.right = '0%';
    
    startHandle.addEventListener('mousedown', (e) => startDrag(e, 'start'));
    endHandle.addEventListener('mousedown', (e) => startDrag(e, 'end'));
    startHandle.addEventListener('touchstart', (e) => startDrag(e, 'start'), { passive: false });
    endHandle.addEventListener('touchstart', (e) => startDrag(e, 'end'), { passive: false });
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    startTimeInput.addEventListener('input', onTimeInputChange);
    startTimeInput.addEventListener('change', onTimeInputChange);
    endTimeInput.addEventListener('input', onTimeInputChange);
    endTimeInput.addEventListener('change', onTimeInputChange);
}

function destroyTimeline() {
    isDragging = false;
    activeHandle = null;
    
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
}

function startDrag(e, handle) {
    e.preventDefault();
    isDragging = true;
    activeHandle = handle;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
}

function stopDrag() {
    if (!isDragging) return;
    isDragging = false;
    activeHandle = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

function onDrag(e) {
    if (!isDragging || !activeHandle || !timelineTrack) return;
    e.preventDefault();
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = timelineTrack.getBoundingClientRect();
    const trackWidth = rect.width;
    
    let position = clientX - rect.left;
    position = Math.max(0, Math.min(position, trackWidth));
    let percent = (position / trackWidth) * 100;
    
    const duration = currentVideoData?.duration_seconds || 0;
    if (duration <= 0) return;
    
    const currentStartPercent = parseFloat(startHandle.style.left) || 0;
    const currentEndPercent = parseFloat(endHandle.style.left) || 100;
    
    const minGap = 1;
    
    if (activeHandle === 'start') {
        percent = Math.min(percent, currentEndPercent - minGap);
        percent = Math.max(0, percent);
        startHandle.style.left = `${percent}%`;
        
        const seconds = Math.floor((percent / 100) * duration);
        startTimeInput.value = formatTimeForInput(seconds);
    } else if (activeHandle === 'end') {
        percent = Math.max(percent, currentStartPercent + minGap);
        percent = Math.min(100, percent);
        endHandle.style.left = `${percent}%`;
        
        const seconds = Math.floor((percent / 100) * duration);
        endTimeInput.value = formatTimeForInput(seconds);
    }
    
    updateSelectionArea();
}

function updateSelectionArea() {
    if (!timelineSelection || !startHandle || !endHandle) return;
    
    const startPercent = parseFloat(startHandle.style.left) || 0;
    const endPercent = parseFloat(endHandle.style.left) || 100;
    
    timelineSelection.style.left = `${startPercent}%`;
    timelineSelection.style.right = `${100 - endPercent}%`;
}

function updateTimelineFromInputs() {
    if (!timelineTrack || !startHandle || !endHandle || !timelineSelection) return;
    
    const duration = currentVideoData?.duration_seconds || 0;
    if (duration <= 0) return;
    
    let startSeconds = parseTimeToSeconds(startTimeInput.value);
    let endSeconds = parseTimeToSeconds(endTimeInput.value);
    
    startSeconds = Math.max(0, Math.min(startSeconds, duration));
    endSeconds = Math.max(0, Math.min(endSeconds, duration));
    
    if (startSeconds > endSeconds && endSeconds > 0) {
        startSeconds = endSeconds;
        startTimeInput.value = formatTimeForInput(startSeconds);
    }
    
    const startPercent = (startSeconds / duration) * 100;
    const endPercent = endSeconds === 0 ? 100 : (endSeconds / duration) * 100;
    
    startHandle.style.left = `${startPercent}%`;
    endHandle.style.left = `${endPercent}%`;
    
    updateSelectionArea();
}

function onTimeInputChange() {
    updateTimelineFromInputs();
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
        const response = await fetchWithCSRF('/api/analyze', {
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
    const audioDetected = document.getElementById('audioDetected');
    if (audioDetected) {
        const label = data.best_audio_label || 'M4A/AAC';
        const bitrate = data.best_audio_bitrate ? `${data.best_audio_bitrate} kbps` : '~128 kbps';
        audioDetected.textContent = `Detected: ${label.toUpperCase()} • ${bitrate}`;
    }
    
    // Update estimated file size
    calculateEstimatedSize();
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
        
        const response = await fetchWithCSRF('/api/jobs/create', {
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

// Mode Button Event Listeners
// Naming: mode{TargetMode}{PanelContext}
// - TargetMode: which mode to switch TO (Video/Audio/Thumbnail)
// - PanelContext: which panel contains this button (empty=Video, Audio, Thumb)

// Buttons in Video Mode panel
document.getElementById('modeVideo')?.addEventListener('click', switchToVideoMode);
document.getElementById('modeAudio')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeThumbnail')?.addEventListener('click', switchToThumbnailMode);

// Buttons in Audio Mode panel
document.getElementById('modeVideoAudio')?.addEventListener('click', switchToVideoMode);
document.getElementById('modeAudioAudio')?.addEventListener('click', switchToAudioMode);
document.getElementById('modeThumbnailAudio')?.addEventListener('click', switchToThumbnailMode);

// Buttons in Thumbnail Mode panel
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

// Quality and video type changes (update estimated size)
qualitySelect?.addEventListener('change', calculateEstimatedSize);
videoTypeSelect?.addEventListener('change', calculateEstimatedSize);

// Start processing button
startProcessingBtn?.addEventListener('click', startProcessing);

// ========================================
// Initialize
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Fetch CSRF token first
    await fetchCSRFToken();
    
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
