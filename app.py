"""
MediaDownloader Web - YouTube Downloader
=========================================
Flask app with single download mode + Audio + Trim + Thumbnail (YouTube Only)
"""
from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import os
import uuid
import threading
from datetime import datetime
import subprocess
import sys
import re
import logging
import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mediadownloader.log'),
        logging.StreamHandler()
    ]
)

app = Flask(__name__)
CORS(app)

# ========================================
# Configuration
# ========================================
STORAGE_DIR = os.path.join(os.path.dirname(__file__), 'storage')
YOUTUBE_VIDEO_DIR = os.path.join(STORAGE_DIR, 'YouTube', 'Videos')
YOUTUBE_AUDIO_DIR = os.path.join(STORAGE_DIR, 'YouTube', 'Audio')
YOUTUBE_CLIPS_DIR = os.path.join(STORAGE_DIR, 'YouTube', 'Clips')
YOUTUBE_THUMBNAILS_DIR = os.path.join(STORAGE_DIR, 'YouTube', 'Thumbnails')

for dir_path in [YOUTUBE_VIDEO_DIR, YOUTUBE_AUDIO_DIR, YOUTUBE_CLIPS_DIR, YOUTUBE_THUMBNAILS_DIR]:
    os.makedirs(dir_path, exist_ok=True)

# ========================================
# Cookies Configuration
# ========================================
YTDLP_COOKIES = os.environ.get('YTDLP_COOKIES', None)  # Optional cookies file path

# ========================================
# Single Download State
# ========================================
state_lock = threading.Lock()
jobs = {}
is_downloading = False

# ========================================
# ffmpeg Cache
# ========================================
_ffmpeg_available = None

def check_ffmpeg_available(force_check=False):
    global _ffmpeg_available
    if _ffmpeg_available is not None and not force_check:
        return _ffmpeg_available
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        _ffmpeg_available = (result.returncode == 0)
    except:
        _ffmpeg_available = False
    return _ffmpeg_available

def try_add_browser_cookies(ydl_opts):
    """
    Use cookies file if YTDLP_COOKIES env var is set.
    Otherwise, cookies are disabled.
    """
    if YTDLP_COOKIES and os.path.exists(YTDLP_COOKIES):
        ydl_opts['cookiefile'] = YTDLP_COOKIES
        logging.info(f"🍪 Using cookies file: {YTDLP_COOKIES}")
        return True
    else:
        logging.info("🔒 No cookies file configured")
        return False

# ========================================
# Utility Functions
# ========================================
def sanitize_filename(filename):
    if not filename:
        return 'file'
    invalid_chars = r'[<>:"/\\|?*]'
    filename = re.sub(invalid_chars, '_', filename).strip()
    if len(filename) > 200:
        name, ext = os.path.splitext(filename)
        filename = name[:200] + ext
    return filename

def validate_youtube_url(url):
    if not url:
        return False, 'URL is required'
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        return False, 'URL must start with http:// or https://'
    patterns = [
        r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'(?:https?://)?(?:www\.)?youtu\.be/[\w-]+',
        r'(?:https?://)?(?:www\.)?youtube\.com/shorts/[\w-]+',
        r'(?:https?://)?(?:www\.)?youtube\.com/embed/[\w-]+',
        r'(?:https?://)?(?:www\.)?youtube\.com/live/[\w-]+',
    ]
    for pattern in patterns:
        if re.search(pattern, url):
            return True, None
    return False, 'Invalid YouTube URL format'

def validate_time_format(time_str):
    """Validate HH:MM:SS format"""
    if not time_str:
        return False, 'Time cannot be empty'
    pattern = r'^(\d{1,2}):([0-5]\d):([0-5]\d)$'
    match = re.match(pattern, time_str)
    if not match:
        return False, 'Time must be in HH:MM:SS format'
    return True, None

def time_to_seconds(time_str):
    """Convert HH:MM:SS to seconds"""
    h, m, s = map(int, time_str.split(':'))
    return h * 3600 + m * 60 + s

def format_requires_merge(format_string):
    if not format_string:
        return False
    return '+' in format_string.split('/')[0]

def get_output_directory(mode, is_trim=False):
    """Get appropriate output directory based on mode"""
    if mode == 'thumbnail':
        return YOUTUBE_THUMBNAILS_DIR
    elif mode == 'audio_only':
        return YOUTUBE_AUDIO_DIR
    elif is_trim:
        return YOUTUBE_CLIPS_DIR
    else:
        return YOUTUBE_VIDEO_DIR

def get_ydl_options(mode, video_type, quality, video_id, thumbnail_format=None):
    """
    Generate yt-dlp options based on mode and settings.
    
    Args:
        mode: 'video', 'audio_only', 'thumbnail'
        video_type: 'video_audio' or 'video_only' (only for mode='video')
        quality: 'best' or integer like 1080, 720
        video_id: video identifier
        thumbnail_format: 'jpg' or 'png' (only for mode='thumbnail')
    """
    output_dir = get_output_directory(mode)
    output_template = os.path.join(output_dir, f'{video_id}.%(ext)s')
    
    base_opts = {
        'outtmpl': output_template,
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': False,
        'no_color': True,
        'retries': 3,
        'fragment_retries': 3,
    }
    
    # Add cookies if available
    try_add_browser_cookies(base_opts)
    
    # Mode-specific format
    if mode == 'thumbnail':
        base_opts['skip_download'] = True
        base_opts['writethumbnail'] = True
        return base_opts
    
    elif mode == 'audio_only':
        # Audio only: best audio, no conversion
        base_opts['format'] = 'bestaudio/best'
        return base_opts
    
    elif mode == 'video':
        # Video mode
        if quality == 'best':
            # Best quality
            if video_type == 'video_audio':
                base_opts['format'] = 'bestvideo+bestaudio/best'
            else:  # video_only
                base_opts['format'] = 'bestvideo/bestvideo'
        else:
            # Specific quality (height number)
            try:
                height = int(quality)
                if video_type == 'video_audio':
                    base_opts['format'] = f'bestvideo[height<={height}]+bestaudio/best[height<={height}]/best'
                else:  # video_only
                    base_opts['format'] = f'bestvideo[height<={height}]/bestvideo/best[height<={height}]'
            except ValueError:
                # Fallback to best if quality is invalid
                if video_type == 'video_audio':
                    base_opts['format'] = 'bestvideo+bestaudio/best'
                else:
                    base_opts['format'] = 'bestvideo/bestvideo'
        
        return base_opts
    
    return base_opts

def trim_video(input_file, output_file, start_time, end_time, video_type='video_audio'):
    """
    Trim video using ffmpeg copy mode (no re-encode).
    
    Args:
        video_type: 'video_audio' (keep audio) or 'video_only' (remove audio)
    
    Returns: (success, error_message)
    """
    if not check_ffmpeg_available():
        return False, 'ffmpeg is required for trimming but not installed'
    
    cmd = [
        'ffmpeg',
        '-ss', start_time,
        '-to', end_time,
        '-i', input_file,
        '-c', 'copy',  # CRITICAL: copy mode, no re-encode
        '-avoid_negative_ts', 'make_zero',
    ]
    
    # Remove audio if video_only
    if video_type == 'video_only':
        cmd.extend(['-an'])  # Remove audio stream
    
    cmd.extend([output_file, '-y'])
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            error = result.stderr
            if 'could not seek' in error.lower() or 'keyframe' in error.lower():
                return False, 'Trim failed: Copy mode requires seeking to keyframes. The specified times may not align with keyframes.'
            return False, f'ffmpeg trim failed: {error}'
        
        if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
            return False, 'Trim produced empty file'
        
        return True, None
    
    except subprocess.TimeoutExpired:
        return False, 'Trim operation timed out (>5 minutes)'
    except Exception as e:
        return False, f'Trim error: {str(e)}'

def convert_thumbnail(input_file, output_format='jpg'):
    """
    Convert thumbnail to JPG or PNG without resizing.
    
    Args:
        input_file: Path to downloaded thumbnail (may be WEBP)
        output_format: 'jpg' or 'png'
    
    Returns: (output_path, error_message)
    """
    if not check_ffmpeg_available():
        # If ffmpeg not available, try to return as-is if already in correct format
        ext = os.path.splitext(input_file)[1].lower()
        if ext == f'.{output_format}':
            return input_file, None
        return None, 'ffmpeg required for thumbnail conversion'
    
    output_ext = 'jpg' if output_format == 'jpg' else 'png'
    output_file = os.path.splitext(input_file)[0] + f'.{output_ext}'
    
    cmd = [
        'ffmpeg',
        '-i', input_file,
        '-vframes', '1',  # Single frame
        '-q:v', '2',      # High quality for JPG
    ]
    
    if output_format == 'png':
        cmd.extend(['-compression_level', '6'])  # PNG compression
    
    cmd.extend([output_file, '-y'])
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            return None, f'Thumbnail conversion failed: {result.stderr}'
        
        if not os.path.exists(output_file):
            return None, 'Converted thumbnail not found'
        
        # Delete original if different
        if input_file != output_file and os.path.exists(input_file):
            try:
                os.remove(input_file)
            except:
                pass
        
        return output_file, None
    
    except subprocess.TimeoutExpired:
        return None, 'Thumbnail conversion timeout'
    except Exception as e:
        return None, f'Conversion error: {str(e)}'

def format_error_message(error):
    error_str = str(error).lower()
    if 'ffmpeg' in error_str or 'ffprobe' in error_str:
        return 'ffmpeg غير مثبت. يرجى تثبيته من https://ffmpeg.org/download.html'
    if 'merge' in error_str:
        return 'خطأ في دمج الفيديو والصوت. تأكد من تثبيت ffmpeg.'
    if 'dpapi' in error_str or 'decrypt' in error_str:
        return '❌ خطأ DPAPI - تم تعطيل الـ cookies. جرب التحميل مرة أخرى.'
    if 'could not copy' in error_str and 'cookie' in error_str:
        return '🍪 خطأ cookies - تم تعطيل الـ cookies تلقائياً. معظم الفيديوهات تعمل بدونها.'
    if 'sign in' in error_str and 'bot' in error_str:
        return '⚠️ YouTube يطلب التحقق. جرب فيديو آخر أو انتظر قليلاً ثم حاول مرة أخرى. معظم الفيديوهات تعمل بدون مشاكل.'
    if 'cookies' in error_str:
        return 'خطأ في ملفات تعريف الارتباط. معظم الفيديوهات تعمل بدون cookies.'
    if 'private video' in error_str:
        return 'الفيديو خاص ولا يمكن الوصول إليه'
    if 'video unavailable' in error_str or 'not available' in error_str:
        return 'الفيديو غير متاح أو تم حذفه'
    if 'age' in error_str and 'restrict' in error_str:
        return 'الفيديو مقيد بالعمر. يحتاج تسجيل دخول في YouTube.'
    if 'copyright' in error_str:
        return 'الفيديو محظور بسبب حقوق النشر'
    if 'network' in error_str or 'connection' in error_str:
        return 'خطأ في الاتصال بالشبكة'
    return str(error)

def find_actual_output_file(base_path, video_id, output_dir):
    if os.path.exists(base_path):
        return base_path
    
    base_name = os.path.splitext(base_path)[0]
    for ext in ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v', '.m4a', '.opus', '.webm', '.jpg', '.png']:
        potential = base_name + ext
        if os.path.exists(potential):
            return potential
    
    pattern = os.path.join(output_dir, f'{video_id}.*')
    matches = [m for m in glob.glob(pattern) if not m.endswith(('.part', '.ytdl', '.temp'))]
    if matches:
        return max(matches, key=os.path.getmtime)
    
    return None

class Job:
    def __init__(self, url, mode='video', video_type='video_audio', quality='best',
                 trim=False, start_time=None, end_time=None, thumbnail_format='jpg'):
        self.id = str(uuid.uuid4())
        self.platform = 'youtube'
        self.url = url
        self.mode = mode
        self.video_type = video_type  # 'video_audio' or 'video_only'
        self.quality = quality  # 'best' or number like '1080'
        self.thumbnail_format = thumbnail_format  # 'jpg' or 'png'
        self.trim = trim
        self.start_time = start_time
        self.end_time = end_time
        
        self.status = 'processing'  # Changed from 'running'
        self.stage = 'initializing'  # New: for polling
        self.progress = 0
        
        self.video_id = None
        self.video_title = None
        self.filename = None
        self.output_path = None
        self.download_url = None
        self.file_size = None
        self.resolution = None
        self.format_note = None
        self.final_ext = None
        self.audio_codec = None
        self.audio_bitrate = None
        self.thumbnail_url = None
        
        self.error_message = None
        self.created_at = datetime.now().isoformat()
        self.started_at = datetime.now().isoformat()
        self.finished_at = None
    
    def to_dict(self):
        return {
            'id': self.id,
            'platform': self.platform,
            'url': self.url,
            'mode': self.mode,
            'video_type': self.video_type,
            'quality': self.quality,
            'thumbnail_format': self.thumbnail_format,
            'trim': self.trim,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'status': self.status,
            'stage': self.stage,
            'progress': self.progress,
            'video_id': self.video_id,
            'video_title': self.video_title,
            'filename': self.filename,
            'output_path': self.output_path,
            'download_url': self.download_url,
            'file_size': self.file_size,
            'resolution': self.resolution,
            'format_note': self.format_note,
            'final_ext': self.final_ext,
            'audio_codec': self.audio_codec,
            'audio_bitrate': self.audio_bitrate,
            'thumbnail_url': self.thumbnail_url,
            'error_message': self.error_message,
            'created_at': self.created_at,
            'started_at': self.started_at,
            'finished_at': self.finished_at
        }

# ========================================
# Download Worker
# ========================================
def download_worker(job_id):
    global is_downloading
    try:
        _do_download(job_id)
    finally:
        with state_lock:
            is_downloading = False

def _do_download(job_id):
    with state_lock:
        job = jobs.get(job_id)
        if not job:
            return
        job.stage = 'initializing'
    
    logging.info(f"🎬 Job {job_id} | Mode: {job.mode} | URL: {job.url}")
    
    try:
        import yt_dlp
        
        # Extract info
        with state_lock:
            job.stage = 'extracting_info'
        
        info_opts = {
            'quiet': True, 
            'no_warnings': True, 
            'skip_download': True
        }
        try_add_browser_cookies(info_opts)
        
        logging.info("📋 Extracting video info")
        
        with yt_dlp.YoutubeDL(info_opts) as ydl:
            info = ydl.extract_info(job.url, download=False)
            video_id = info.get('id', str(uuid.uuid4())[:8])
            video_title = info.get('title', 'Unknown')
            
            # Extract metadata
            resolution = None
            format_note = None
            audio_codec = None
            audio_bitrate = None
            thumbnail_url = None
            
            try:
                if 'requested_formats' in info and info['requested_formats']:
                    vf = info['requested_formats'][0]
                    w, h = vf.get('width'), vf.get('height')
                    if w and h:
                        resolution = f"{w}x{h}"
                    format_note = vf.get('format_note', '')
                    
                    # Audio info from second format if available
                    if len(info['requested_formats']) > 1:
                        af = info['requested_formats'][1]
                        audio_codec = af.get('acodec', '')
                        audio_bitrate = af.get('abr', '')
                elif info.get('width') and info.get('height'):
                    resolution = f"{info['width']}x{info['height']}"
                    format_note = info.get('format_note', '')
                
                # Audio-only metadata
                if job.mode == 'audio_only':
                    audio_codec = info.get('acodec', '')
                    audio_bitrate = info.get('abr', '')
                
                # Thumbnail URL
                if 'thumbnails' in info and info['thumbnails']:
                    # Get highest resolution thumbnail
                    thumbnails = sorted(info['thumbnails'], 
                                      key=lambda x: (x.get('width', 0) * x.get('height', 0)), 
                                      reverse=True)
                    thumbnail_url = thumbnails[0].get('url', '') if thumbnails else ''
            except:
                pass
            
            with state_lock:
                job.video_id = video_id
                job.video_title = video_title
                if resolution:
                    job.resolution = resolution
                if format_note:
                    job.format_note = format_note
                if audio_codec:
                    job.audio_codec = audio_codec
                if audio_bitrate:
                    job.audio_bitrate = audio_bitrate
                if thumbnail_url:
                    job.thumbnail_url = thumbnail_url
        
        # Thumbnail mode: download thumbnail only
        if job.mode == 'thumbnail':
            with state_lock:
                job.stage = 'downloading_thumbnail'
            
            ydl_opts = get_ydl_options(job.mode, None, None, video_id)
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([job.url])
            
            # Find thumbnail file
            output_dir = get_output_directory(job.mode)
            thumbnail_file = find_actual_output_file('', video_id, output_dir)
            
            if not thumbnail_file:
                raise FileNotFoundError('Thumbnail file not found')
            
            # Convert thumbnail to requested format
            with state_lock:
                job.stage = 'converting_thumbnail'
                job.progress = 90
            
            converted_file, error = convert_thumbnail(thumbnail_file, job.thumbnail_format)
            if error:
                raise RuntimeError(error)
            
            thumbnail_file = converted_file
            
            with state_lock:
                job.status = 'success'
                job.progress = 100
                job.stage = 'completed'
                job.filename = os.path.basename(thumbnail_file)
                job.output_path = thumbnail_file
                job.download_url = f'/api/files/download/{job.id}'
                job.file_size = os.path.getsize(thumbnail_file)
                job.final_ext = os.path.splitext(thumbnail_file)[1].lstrip('.').upper()
                job.finished_at = datetime.now().isoformat()
            
            logging.info(f"Job {job_id} completed (thumbnail): {job.filename}")
            return
        
        # ffmpeg precheck for merge/trim
        ydl_opts = get_ydl_options(job.mode, job.video_type, job.quality, video_id)
        if format_requires_merge(ydl_opts.get('format', '')) or job.trim:
            if not check_ffmpeg_available():
                raise RuntimeError('ffmpeg is required but not installed')
        
        # Progress hooks
        def progress_hook(d):
            if d['status'] == 'downloading':
                try:
                    if '_percent_str' in d:
                        pct = float(d['_percent_str'].strip().replace('%', ''))
                        with state_lock:
                            job.progress = min(int(pct), 85 if job.trim else 95)
                    elif d.get('downloaded_bytes') and d.get('total_bytes'):
                        pct = (d['downloaded_bytes'] / d['total_bytes']) * 100
                        with state_lock:
                            job.progress = min(int(pct), 85 if job.trim else 95)
                    job.stage = 'downloading'
                except:
                    pass
            elif d['status'] == 'finished':
                with state_lock:
                    job.progress = 90 if job.trim else 96
                    job.stage = 'merging' if not job.trim else 'preparing_trim'
        
        def postprocessor_hook(d):
            with state_lock:
                if d['status'] == 'started':
                    job.progress = 97
                    job.stage = 'processing'
                elif d['status'] == 'finished':
                    job.progress = 99
                    job.stage = 'finalizing'
        
        ydl_opts['progress_hooks'] = [progress_hook]
        ydl_opts['postprocessor_hooks'] = [postprocessor_hook]
        
        logging.info("⬇️ Starting download")
        
        # Download
        with state_lock:
            job.stage = 'downloading'
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            download_info = ydl.extract_info(job.url, download=True)
            expected_filename = ydl.prepare_filename(download_info)
        
        output_dir = get_output_directory(job.mode, job.trim)
        actual_file = find_actual_output_file(expected_filename, video_id, output_dir)
        
        if not actual_file or not os.path.exists(actual_file):
            raise FileNotFoundError('Downloaded file not found')
        
        # Trim if requested
        if job.trim:
            with state_lock:
                job.progress = 90
                job.stage = 'trimming'
            
            trimmed_filename = f"{video_id}_trimmed_{job.start_time.replace(':', '-')}_to_{job.end_time.replace(':', '-')}{os.path.splitext(actual_file)[1]}"
            trimmed_path = os.path.join(YOUTUBE_CLIPS_DIR, trimmed_filename)
            
            success, error_msg = trim_video(actual_file, trimmed_path, job.start_time, job.end_time, job.video_type)
            
            if not success:
                raise RuntimeError(f'Trim failed: {error_msg}')
            
            # Use trimmed file as final output
            actual_file = trimmed_path
            
            with state_lock:
                job.progress = 99
                job.stage = 'finalizing'
        
        # Final metadata
        _, ext = os.path.splitext(actual_file)
        file_size = os.path.getsize(actual_file)
        
        with state_lock:
            job.status = 'success'
            job.progress = 100
            job.stage = 'completed'
            job.filename = os.path.basename(actual_file)
            job.output_path = actual_file
            job.download_url = f'/api/files/download/{job.id}'
            job.file_size = file_size
            job.final_ext = ext.lstrip('.').upper() if ext else 'N/A'
            job.finished_at = datetime.now().isoformat()
        
        logging.info(f"Job {job_id} completed: {job.filename}")
    
    except Exception as e:
        with state_lock:
            job = jobs.get(job_id)
            if job:
                job.status = 'failed'
                job.error_message = format_error_message(e)
                job.finished_at = datetime.now().isoformat()
                job.stage = 'failed'
        
        logging.error(f"Job {job_id} failed: {e}")

# ========================================
# API Routes
# ========================================

@app.route('/')
def index():
    """Main home page with new design"""
    return render_template('index.html')

@app.route('/app')
def app_page():
    """Redirect to main home page"""
    return render_template('index.html')

@app.route('/auth')
def auth_page():
    """Authentication page - Login & Signup"""
    return render_template('auth.html')

@app.route('/dashboard')
def dashboard_page():
    """Dashboard page"""
    return render_template('Dashboard.html')

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    """Analyze YouTube URL and return metadata."""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        # Validate URL
        is_valid, error_msg = validate_youtube_url(url)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        import yt_dlp
        
        # Extract info only (no download)
        info_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True
        }
        try_add_browser_cookies(info_opts)
        
        with yt_dlp.YoutubeDL(info_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            video_id = info.get('id', '')
            title = info.get('title', 'Unknown Title')
            duration_seconds = info.get('duration', 0)
            
            # Get thumbnail
            thumbnail_url = ''
            if 'thumbnails' in info and info['thumbnails']:
                thumbnails = sorted(info['thumbnails'],
                                   key=lambda x: (x.get('width', 0) * x.get('height', 0)),
                                   reverse=True)
                thumbnail_url = thumbnails[0].get('url', '') if thumbnails else ''
            
            # Extract available qualities (unique heights)
            available_qualities = []
            formats = info.get('formats', [])
            seen_heights = set()
            
            for f in formats:
                height = f.get('height')
                # Only video formats with valid height
                if height and height not in seen_heights and f.get('vcodec') != 'none':
                    seen_heights.add(height)
                    available_qualities.append(height)
            
            # Sort descending
            available_qualities.sort(reverse=True)
            
            # Get best audio label (optional for display)
            best_audio_label = ''
            audio_formats = [f for f in formats if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
            if audio_formats:
                best_audio = max(audio_formats, key=lambda x: x.get('abr', 0))
                ext = best_audio.get('ext', '')
                codec = best_audio.get('acodec', '').split('.')[0]
                best_audio_label = f"{ext}/{codec}" if ext and codec else ''
            
            return jsonify({
                'success': True,
                'video_id': video_id,
                'title': title,
                'duration_seconds': duration_seconds,
                'thumbnail_url': thumbnail_url,
                'available_qualities': available_qualities,
                'best_audio_label': best_audio_label
            })
    
    except Exception as e:
        logging.error(f"Error analyzing video: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/create', methods=['POST'])
def create_job():
    """Create a new download job."""
    global is_downloading
    
    try:
        data = request.get_json()
        
        # Extract parameters
        url = data.get('url', '').strip()
        mode = data.get('mode', 'video')
        video_type = data.get('video_type', 'video_audio')
        quality = data.get('quality', 'best')
        trim = data.get('trim', False)
        start_time = data.get('start_time', '')
        end_time = data.get('end_time', '')
        thumbnail_format = data.get('thumbnail_format', 'jpg')
        
        # Validate URL
        is_valid, error_msg = validate_youtube_url(url)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Validate mode
        valid_modes = ['video', 'audio_only', 'thumbnail']
        if mode not in valid_modes:
            return jsonify({'error': f'Invalid mode. Must be one of: {", ".join(valid_modes)}'}), 400
        
        # Validate video_type (only for video mode)
        if mode == 'video':
            if video_type not in ['video_audio', 'video_only']:
                return jsonify({'error': 'video_type must be video_audio or video_only'}), 400
        
        # Validate thumbnail_format
        if mode == 'thumbnail':
            if thumbnail_format not in ['jpg', 'png']:
                return jsonify({'error': 'thumbnail_format must be jpg or png'}), 400
            if trim:
                return jsonify({'error': 'Cannot trim thumbnails'}), 400
        
        # Validate trim
        if trim:
            if mode not in ['video']:
                return jsonify({'error': 'Trim only available for video mode'}), 400
            
            # Check end_time not 00:00:00
            if end_time == '00:00:00':
                return jsonify({'error': 'Please set an end time.'}), 400
            
            # Validate time formats
            is_valid, error_msg = validate_time_format(start_time)
            if not is_valid:
                return jsonify({'error': f'Invalid start_time: {error_msg}'}), 400
            
            is_valid, error_msg = validate_time_format(end_time)
            if not is_valid:
                return jsonify({'error': f'Invalid end_time: {error_msg}'}), 400
            
            start_sec = time_to_seconds(start_time)
            end_sec = time_to_seconds(end_time)
            
            if start_sec >= end_sec:
                return jsonify({'error': 'End time must be greater than start time'}), 400
        
        # Check if already downloading
        with state_lock:
            if is_downloading:
                return jsonify({'error': 'A download is already running. Please wait.'}), 409
            
            # Create job
            job = Job(
                url=url,
                mode=mode,
                video_type=video_type,
                quality=quality,
                trim=trim,
                start_time=start_time if trim else None,
                end_time=end_time if trim else None,
                thumbnail_format=thumbnail_format
            )
            jobs[job.id] = job
            is_downloading = True
        
        logging.info(f"Job created: {job.id} - {mode} - {url}")
        
        # Start worker
        thread = threading.Thread(target=download_worker, args=(job.id,), daemon=True)
        thread.start()
        
        return jsonify({
            'success': True,
            'job_id': job.id,
            'message': 'Download started'
        })
    
    except Exception as e:
        logging.error(f"Error creating job: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/jobs/<job_id>', methods=['GET'])
def get_job(job_id):
    with state_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        return jsonify(job.to_dict())

@app.route('/api/jobs', methods=['GET'])
def list_jobs():
    with state_lock:
        jobs_list = [job.to_dict() for job in jobs.values()]
        jobs_list.sort(key=lambda x: x['created_at'], reverse=True)
        running_count = sum(1 for j in jobs_list if j['status'] == 'running')
        
        return jsonify({
            'jobs': jobs_list,
            'total': len(jobs_list),
            'is_downloading': is_downloading,
            'running_count': running_count
        })

@app.route('/api/jobs/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    with state_lock:
        if job_id not in jobs:
            return jsonify({'error': 'Job not found'}), 404
        del jobs[job_id]
        logging.info(f"Job deleted: {job_id}")
        return jsonify({'success': True, 'message': 'Job deleted'})

@app.route('/api/files/download/<job_id>', methods=['GET'])
def download_file(job_id):
    with state_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        if job.status != 'success':
            return jsonify({'error': 'Job not completed'}), 400
        
        output_path = job.output_path
        filename = job.filename
        video_title = job.video_title
        
        if not output_path or not os.path.exists(output_path):
            return jsonify({'error': 'File not found'}), 404
    
    download_name = filename
    if video_title:
        _, ext = os.path.splitext(filename)
        download_name = sanitize_filename(video_title) + ext
    
    return send_file(output_path, as_attachment=True, download_name=download_name)

@app.route('/api/files/open-folder/<job_id>', methods=['POST'])
def open_folder(job_id):
    with state_lock:
        job = jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        output_path = job.output_path
        
        if not output_path:
            return jsonify({'error': 'No file path'}), 400
    
    folder_path = os.path.dirname(output_path)
    
    try:
        if sys.platform == 'win32':
            os.startfile(folder_path)
        elif sys.platform == 'darwin':
            subprocess.run(['open', folder_path])
        else:
            subprocess.run(['xdg-open', folder_path])
        
        return jsonify({'success': True, 'folder_path': folder_path})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    with state_lock:
        total = len(jobs)
        downloading = is_downloading
    
    return jsonify({
        'status': 'ok',
        'total_jobs': total,
        'is_downloading': downloading,
        'ffmpeg_available': check_ffmpeg_available(),
        'storage_dirs': {
            'youtube_videos': YOUTUBE_VIDEO_DIR,
            'youtube_audio': YOUTUBE_AUDIO_DIR,
            'youtube_clips': YOUTUBE_CLIPS_DIR,
            'youtube_thumbnails': YOUTUBE_THUMBNAILS_DIR
        }
    })

# ========================================
# Main
# ========================================
if __name__ == '__main__':
    ffmpeg_status = "✓ Available" if check_ffmpeg_available() else "✗ NOT FOUND"
    
    print("=" * 60)
    print("MediaDownloader Web - YouTube Downloader")
    print("=" * 60)
    print(f"YouTube Videos: {YOUTUBE_VIDEO_DIR}")
    print(f"YouTube Audio: {YOUTUBE_AUDIO_DIR}")
    print(f"YouTube Clips: {YOUTUBE_CLIPS_DIR}")
    print(f"YouTube Thumbnails: {YOUTUBE_THUMBNAILS_DIR}")
    print(f"ffmpeg: {ffmpeg_status}")
    # Get local IP for network access
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except:
        local_ip = "YOUR_IP"
    
    print("=" * 60)
    print("Server URLs:")
    print(f"  Local:   http://127.0.0.1:5000")
    print(f"  Network: http://{local_ip}:5000")
    print("=" * 60)
    
    # host='0.0.0.0' allows access from other devices on the network
    app.run(debug=False, host='0.0.0.0', port=5000)