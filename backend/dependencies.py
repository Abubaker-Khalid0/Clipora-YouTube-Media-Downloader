"""
dependencies.py — Shared FastAPI dependencies for Clipora backend.

Provides:
    verify_internal_api_key — constant-time shared-secret guard for all API routes.

Security model:
    The Next.js proxy is the only authorised caller of this backend.
    Every request must carry the X-Internal-Api-Key header whose value matches
    INTERNAL_API_KEY from the environment.  The comparison is performed with
    hmac.compare_digest() to prevent timing-based side-channel attacks.
"""

from __future__ import annotations

import hmac
import logging
import os
from typing import Annotated

from fastapi import Header, HTTPException, status

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Read the key once at import time.
# main.py calls load_dotenv() *before* importing this module, so os.getenv()
# already sees the populated environment by the time this line executes.
# ---------------------------------------------------------------------------
_INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "").strip()

# Minimum acceptable key length (characters).
# Matches the startup guard in main.py — both must agree on this value.
_MIN_KEY_LENGTH: int = 32


# ---------------------------------------------------------------------------
# Dependency
# ---------------------------------------------------------------------------

async def verify_internal_api_key(
    x_internal_api_key: Annotated[
        str | None,
        Header(
            alias="x-internal-api-key",
            description="Shared secret between Next.js proxy and FastAPI backend.",
            include_in_schema=False,  # never expose this header in OpenAPI docs
        ),
    ] = None,
) -> None:
    """
    FastAPI dependency — validates the shared-secret internal API key.

    Attach to individual routes or to an entire router via::

        router = APIRouter(dependencies=[Depends(verify_internal_api_key)])

    Raises:
        RuntimeError       – Server misconfiguration: key absent or too short.
        HTTPException 401  – Request carries a missing or invalid key.

    Security guarantees:
        1. hmac.compare_digest() provides constant-time equality so an attacker
           cannot distinguish a "wrong first byte" from a "completely wrong key"
           through response-time differences.
        2. The *received* key is never written to any log, metric, or error body.
        3. The error detail is intentionally identical whether the header is
           absent, empty, or carries the wrong value — nothing is leaked.
        4. include_in_schema=False keeps the header out of the Swagger/OpenAPI UI
           so the existence of the auth mechanism is not advertised.
    """
    # ── Server-side sanity check ────────────────────────────────────────────
    # This is a programming / deployment error, not a client error.
    # Raise immediately so the operator notices during start-up smoke tests
    # rather than silently serving unprotected routes.
    if not _INTERNAL_API_KEY or len(_INTERNAL_API_KEY) < _MIN_KEY_LENGTH:
        logger.critical(
            "INTERNAL_API_KEY is not configured or is too short "
            "(minimum %d characters). All requests are being rejected.",
            _MIN_KEY_LENGTH,
        )
        raise RuntimeError(
            f"INTERNAL_API_KEY must be set and at least {_MIN_KEY_LENGTH} characters. "
            'Generate one with: python -c "import secrets; print(secrets.token_hex(32))"'
        )

    # ── Reject missing / empty header up-front ──────────────────────────────
    # We still call compare_digest below for the non-empty case, but screening
    # the None / empty case here avoids encoding a zero-length bytes object and
    # returning a misleading "wrong key" path instead of "no key provided".
    if not x_internal_api_key or not x_internal_api_key.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # ── Constant-time comparison ────────────────────────────────────────────
    # hmac.compare_digest accepts str directly in Python 3 — no need to encode
    # both sides to bytes, which would add unnecessary overhead for our key sizes.
    if not hmac.compare_digest(x_internal_api_key.strip(), _INTERNAL_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )