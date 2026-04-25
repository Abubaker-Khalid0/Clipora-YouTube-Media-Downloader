"""
limiter.py — Shared SlowAPI rate-limiter instance and limit constants.

Extracted into its own module to break the circular import that arises when
routers import `limiter` from `main` while `main` imports those same routers.
"""

from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# ---------------------------------------------------------------------------
# Rate-limit constants
# Configurable via environment variables so staging / production environments
# can apply different policies without a code change.
# ---------------------------------------------------------------------------

ANALYZE_RATE_LIMIT:    str = os.getenv("ANALYZE_RATE_LIMIT",    "10")
JOB_CREATE_RATE_LIMIT: str = os.getenv("JOB_CREATE_RATE_LIMIT", "5")

# ---------------------------------------------------------------------------
# Limiter instance
#
# key_func=get_remote_address  — rate-limits by client IP.
# headers_enabled=True         — injects X-RateLimit-* response headers so
#                                clients can back off gracefully.
#
# Proxy note: if the backend runs behind nginx / traefik, ensure the proxy
# forwards X-Forwarded-For so get_remote_address() sees the real client IP
# instead of the proxy's internal address.
# ---------------------------------------------------------------------------

limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=True,
    default_limits=[],
)