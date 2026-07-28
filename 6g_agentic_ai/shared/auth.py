"""
JWT authentication utilities shared across all agents.
Every A2A call must include a valid Bearer JWT in the Authorization header.
"""

import jwt
import datetime
from typing import Optional
from fastapi import HTTPException, Request

from shared.config import settings


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
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    if not agent_id:
        raise HTTPException(status_code=401, detail="Missing X-Agent-Id header")

    token = auth_header.replace("Bearer ", "")
    payload = verify_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Ensure the token subject matches the claimed agent ID
    if payload.get("sub") != agent_id:
        raise HTTPException(status_code=403, detail="Token subject does not match X-Agent-Id")

    return payload