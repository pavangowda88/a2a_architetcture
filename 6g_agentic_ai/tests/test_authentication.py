"""OAuth 2.0 resource-server and client-credentials tests."""

from __future__ import annotations

import os
import sys
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("OAUTH_ISSUER_URL", "https://issuer.test/realms/6g")
os.environ.setdefault("OAUTH_AUDIENCE", "6g-agent-services")
os.environ.setdefault("RESOURCE_CLIENT_ID", "resource-server")
os.environ.setdefault("RESOURCE_CLIENT_SECRET", "resource-secret")
os.environ.setdefault("MCP_SERVER_CLIENT_SECRET", "mcp-secret")

import database
from shared.oauth import OAuthClient
from subscriber import app as subscriber_app


async def _set_up_db() -> None:
    database.db = database.InMemoryDatabase()
    await database.db.subscribers.insert_one({
        "imsi": "001010123456789",
        "name": "Test Subscriber",
        "qos_class": "QCI_1_URLLC",
        "service_plan": "6G_ROBOTICS_SLICE",
    })


@pytest.mark.asyncio
async def test_oauth_client_credentials_acquires_and_caches_token(monkeypatch):
    requests = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"access_token": "opaque-access-token", "expires_in": 300})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        "shared.oauth.httpx.AsyncClient",
        lambda **kwargs: real_client(transport=transport, **kwargs),
    )
    client = OAuthClient("mcp-server", "mcp-secret")

    assert await client.get_access_token() == "opaque-access-token"
    assert await client.get_access_token() == "opaque-access-token"
    assert len(requests) == 1
    assert b"grant_type=client_credentials" in requests[0].content


@pytest.mark.asyncio
async def test_protected_endpoint_rejects_missing_token():
    await _set_up_db()
    transport = httpx.ASGITransport(app=subscriber_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/lookup", json={"params": {}})
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "claims,status_code",
    [
        ({"active": False}, 401),
        ({"active": True, "iss": "https://issuer.test/realms/wrong", "scope": "subscriber:read"}, 401),
        ({"active": True, "iss": "https://issuer.test/realms/6g", "aud": "6g-agent-services", "scope": "agent:read"}, 403),
        ({"active": True, "iss": "https://issuer.test/realms/6g", "aud": "6g-agent-services", "scope": "subscriber:read"}, 200),
    ],
)
async def test_oauth_introspection_and_scope_enforcement(claims, status_code):
    await _set_up_db()
    transport = httpx.ASGITransport(app=subscriber_app)
    async def fake_introspection(_token):
        if not claims.get("active"):
            raise HTTPException(status_code=401, detail="Inactive or expired access token")
        if claims.get("iss") != "https://issuer.test/realms/6g":
            raise HTTPException(status_code=401, detail="Invalid token issuer")
        return claims

    with patch("shared.oauth.introspect_access_token", new=AsyncMock(side_effect=fake_introspection)):
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/lookup",
                json={"params": {"imsi": "001010123456789"}},
                headers={"Authorization": "Bearer opaque-access-token"},
            )
    assert response.status_code == status_code
