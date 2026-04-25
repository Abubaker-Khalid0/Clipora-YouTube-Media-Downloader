# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim

# ffmpeg  — required for merge / trim / thumbnail conversion
# curl    — used by Docker Compose healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only the installed packages from the builder stage
COPY --from=builder /install /usr/local

WORKDIR /app

# Copy application source
COPY . .

# Temp directory must exist before the process starts;
# the volume mount in docker-compose will overlay it at runtime.
RUN mkdir -p storage/temp

# Run as a non-root user — reduces blast radius if the process is compromised
RUN groupadd --gid 1001 clipora \
    && useradd --uid 1001 --gid clipora --shell /bin/sh --no-create-home clipora \
    && chown -R clipora:clipora /app

USER clipora

EXPOSE 8000

# workers=1 is intentional: the job store is in-process memory.
# Multiple workers would split the store across processes and break job lookup.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", \
    "--workers", "1", "--no-access-log"]