<h1 align="center">Clipora</h1>

<p align="center">
  <strong>Self-hostable YouTube downloader with trimming, transcripts, and live progress.</strong><br>
  Next.js frontend, FastAPI + yt-dlp backend, no third-party download service in the loop.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js 16.2" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react" alt="React 19.2" />
  <img src="https://img.shields.io/badge/FastAPI-Python_3.13-009688?logo=fastapi" alt="FastAPI on Python 3.13" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker" alt="Docker Compose" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT" />
</p>

---

## What it does

| Output | Details |
|--------|---------|
| **Video** | MP4, merged video + audio. Quality: `best`, 2160, 1440, 1080, 720, 480, 360, 240, 144 |
| **Audio** | Best available audio stream, extracted to a standalone file |
| **Thumbnail** | JPG or PNG, highest resolution the video exposes |
| **Trim** | Precise `HH:MM:SS` range. Video mode only. Can also emit audio-only from a range |
| **Transcript** | Fetches captions with language picker, manual vs. auto-generated flagged, downloadable |

Supporting behaviour that matters in practice:

- **Live progress** over SSE — real yt-dlp progress and stage, not a fake spinner.
- **Download queue** — batch several jobs; the navbar keeps a live counter and the drawer opens as an overlay from anywhere in the dashboard.
- **Single-video guard** — playlist, channel, and `/@handle/videos` URLs are rejected up front; a `list=` param on a video URL is stripped rather than followed.
- **Human error messages** — yt-dlp and FFmpeg failures are mapped to plain language (members-only, age-restricted, FFmpeg missing…), and internal prefixes with video IDs are never surfaced.
- **Auto-cleanup** — a background service deletes temp files and their job records past a TTL, so nothing accumulates on disk.
- **Bilingual UI** — English and Arabic, locale-prefixed routes with full RTL.

> **Burned-in subtitles are not shipped yet.** The subtitle output is marked *coming soon* in the UI. The styling editor exists in the repo, but the job contract has no subtitle field and the processor has no burn-in step, so it is deliberately not rendered.

---

## Requirements

- **Node.js 20+** and **Python 3.11+** (3.13 recommended)
- **FFmpeg** on `PATH` — required for merging video+audio and for trimming. Without it, video jobs fail. [Download](https://ffmpeg.org/download.html)

---

## Quick start

Generate the shared secret once and reuse the same value everywhere:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Backend** — create `backend/.env`:

```env
INTERNAL_API_KEY=<the 64-char value from above>
FRONTEND_URL=http://localhost:3000
ENV=development
```

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** — create `frontend/.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
INTERNAL_API_KEY=<the same value>
```

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**. With `ENV=development`, interactive API docs are at **http://localhost:8000/docs**.

### Docker

```bash
docker compose up --build
```

Compose reads a **root** `.env` and requires `INTERNAL_API_KEY` to be set — the stack refuses to start without it. The frontend waits on the backend's `/health` check before booting.

---

## Configuration

**Backend** (`backend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `INTERNAL_API_KEY` | — | **Required**, min 32 chars. Shared secret for the proxy → backend hop |
| `FRONTEND_URL` | `http://localhost:3000` | Exact CORS origin. `*` is rejected because credentials are allowed |
| `ENV` | `production` | `development` enables `/docs` and error tracebacks |
| `STORAGE_PATH` | `storage/temp` | Where finished files land |
| `MAX_FILE_AGE_MINUTES` | `30` | File TTL before cleanup removes it |
| `CLEANUP_INTERVAL_SECONDS` | `300` | How often the cleanup sweep runs |
| `DOWNLOAD_TIMEOUT_SECONDS` | `1800` | Hang protection per job |
| `ANALYZE_RATE_LIMIT` | `10` | Analyze + transcript calls per minute, per IP |
| `JOB_CREATE_RATE_LIMIT` | `5` | Job creations per minute, per IP |
| `LOG_LEVEL` | `INFO` | Root log level |

**Frontend** (`frontend/.env.local`)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public origin of the app |
| `BACKEND_URL` | Server-side only. `http://backend:8000` under Compose |
| `INTERNAL_API_KEY` | Must match the backend value |

Never commit `.env` files. If a key leaks, rotate it in both places.

---

## Architecture

The browser never reaches FastAPI directly. Next.js route handlers proxy every call and attach `X-Internal-Api-Key` server-side, so the backend can stay unexposed and the secret never reaches the client.

```
Browser ──▶ Next.js route handler ──▶ FastAPI ──▶ yt-dlp / FFmpeg
            (adds internal key)        (validates key, rate-limits)
        ◀── SSE progress relay ────────
```

**Backend endpoints** (`/api` prefix, all key-guarded)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/analyze` | Metadata and available formats for a URL |
| `POST` | `/api/jobs` | Create a download job |
| `GET` | `/api/jobs/{id}` | Poll job status |
| `GET` | `/api/jobs/{id}/stream` | SSE progress stream |
| `GET` | `/api/files/download/{id}` | Stream the finished file |
| `POST` | `/api/transcript` | Fetch captions |
| `GET` | `/health` | Liveness, FFmpeg availability, active job count |

Job state lives in memory. It is intentionally single-instance: horizontal scaling needs a shared store first. The queue is also scoped to the dashboard segment, so navigating away tears it down — surviving navigation requires persistence plus job re-attachment.

---

## Project structure

```
├── backend/                 # FastAPI service
│   ├── main.py              # App setup: logging, CORS, limiter, lifespan
│   ├── limiter.py           # Shared SlowAPI instance + limits
│   ├── dependencies.py      # Internal API key verification
│   ├── utils.py             # URL validation, filename safety, error mapping
│   ├── routers/             # analyze, jobs, files, transcript
│   ├── services/            # downloader, processor, transcript, cleanup
│   └── models/schemas.py    # Pydantic contracts + validators
├── frontend/                # Next.js app
│   ├── app/api/             # Proxy route handlers
│   ├── app/[locale]/        # Dashboard, landing, legal pages
│   ├── components/          # UI, dashboard panels, queue
│   ├── hooks/               # useJobStream, useDownloadQueue, …
│   └── messages/            # en.json, ar.json
└── docker-compose.yml
```

---

## Development

```bash
cd frontend
npm run lint          # eslint, --max-warnings 0
npx tsc --noEmit      # type check
npm run build
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for deeper notes.

---

## Legal

Clipora is a self-hosted tool. You are responsible for what you download with it. Respect YouTube's Terms of Service and the rights of content owners; use it for content you own, content in the public domain, or content you have permission to download.

## License

MIT
