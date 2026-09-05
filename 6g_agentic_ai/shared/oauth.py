"""OAuth 2.0 client-credentials and resource-server helpers."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import HTTPException, Request

from shared.config import settings

logger = logging.getLogger(__name__)


async def introspect_access_token(token: str) -> dict[str, Any]:
    """Validate an OAuth access token through the authorization server."""
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.OAUTH_INTROSPECTION_URL,
                data={"token": token},
                auth=(settings.RESOURCE_CLIENT_ID, settings.RESOURCE_CLIENT_SECRET),
            )
            response.raise_for_status()
            claims = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            "OAuth token introspection failed: %s %s",
            type(exc).__name__,
            str(exc),
        )
        raise HTTPException(status_code=401, detail="Invalid access token")

    logger.info(
        "OAuth introspection claims: active=%r issuer=%r audience=%r scopes=%r expires_at=%r client_id=%r",
        claims.get("active"),
        claims.get("iss"),
        claims.get("aud"),
        claims.get("scope"),
        claims.get("exp"),
        claims.get("client_id", claims.get("azp")),
    )

    if not claims.get("active"):
        logger.warning("OAuth validation rejected token: inactive or expired")
        raise HTTPException(status_code=401, detail="Inactive or expired access token")
    if claims.get("iss") != settings.OAUTH_ISSUER_URL:
        logger.warning(
            "OAuth validation rejected token: issuer mismatch expected=%r actual=%r",
            settings.OAUTH_ISSUER_URL,
            claims.get("iss"),
        )
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    if settings.OAUTH_AUDIENCE:
        if not claims.get("aud"):
            logger.warning("OAuth validation rejected token: missing audience")
            raise HTTPException(status_code=401, detail="Missing token audience")
        audiences = claims["aud"] if isinstance(claims["aud"], list) else [claims["aud"]]
        if settings.OAUTH_AUDIENCE not in audiences:
            logger.warning(
                "OAuth validation rejected token: audience mismatch expected=%r actual=%r",
                settings.OAUTH_AUDIENCE,
                audiences,
            )
            raise HTTPException(status_code=401, detail="Invalid token audience")
    if claims.get("exp") and float(claims["exp"]) <= time.time():
        logger.warning("OAuth validation rejected token: expired exp=%r", claims["exp"])
        raise HTTPException(status_code=401, detail="Expired access token")
    return claims


async def require_oauth_scope(request: Request, required_scope: str | None = None) -> dict[str, Any]:
    """Require a valid OAuth bearer token and, optionally, one scope."""
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    claims = await introspect_access_token(token)
    scopes = set(str(claims.get("scope", "")).split())
    if required_scope and required_scope not in scopes:
        raise HTTPException(status_code=403, detail="Insufficient OAuth scope")
    return claims


class OAuthClient:
    """OAuth client-credentials client with in-memory access-token caching."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self._token: str | None = None
        self._token_expiry = 0.0

    async def get_access_token(self) -> str:
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                settings.OAUTH_TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "scope": settings.OAUTH_SCOPES,
                },
                auth=(self.client_id, self.client_secret),
            )
            response.raise_for_status()
            data = response.json()

        self._token = data["access_token"]
        self._token_expiry = time.time() + int(data.get("expires_in", 300))
        return self._token