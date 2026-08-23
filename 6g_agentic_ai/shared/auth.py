"""
JWT authentication utilities shared across all agents.
Every A2A call must include a valid Bearer JWT in the Authorization header.
"""

import jwt
import datetime
import logging
from typing import Optional
from fastapi import HTTPException, Request

from shared.config import settings

logger = logging.getLogger(__name__)


def create_token(agent_id: str, role: str = "agent") -> str:
    """Create a signed JWT for agent-to-agent authentication."""
    now = datetime.datetime.utcnow()
    payload = {
        "sub": agent_id,
        "role": role,
        "iat": now,
        "exp": now + datetime.timedelta(minutes=settings.JWT_EXPIRY_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT. Returns payload dict or None if invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(request: Request) -> dict:
    """
    FastAPI dependency — extracts and validates the JWT from the
    Authorization header. Raises 401 if missing or invalid.
    Also checks for X-Agent-Id header.
    """
    auth_header = request.headers.get("Authorization")
    agent_id = request.headers.get("X-Agent-Id")

    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("A2A authentication failed: target=%s reason=missing_or_invalid_authorization", request.url.path)
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    if not agent_id:
        logger.warning("A2A authentication failed: target=%s reason=missing_agent_id", request.url.path)
        raise HTTPException(status_code=401, detail="Missing X-Agent-Id header")

    token = auth_header.replace("Bearer ", "")
    payload = verify_token(token)

    if payload is None:
        logger.warning("A2A authentication failed: target=%s agent_id=%s reason=invalid_or_expired_token", request.url.path, agent_id)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Ensure the token subject matches the claimed agent ID
    if payload.get("sub") != agent_id:
        logger.warning("A2A authentication failed: target=%s agent_id=%s reason=subject_mismatch", request.url.path, agent_id)
        raise HTTPException(status_code=403, detail="Token subject does not match X-Agent-Id")

    logger.info("A2A authentication succeeded: target=%s agent_id=%s", request.url.path, agent_id)
    return payload
