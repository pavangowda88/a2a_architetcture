"""Authentication regression tests for service-to-service A2A traffic."""

from __future__ import annotations

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-that-is-at-least-32-bytes")
os.environ.setdefault("AGENT_SECRET", "test-agent-secret-that-is-at-least-32-bytes")

import database
from auth_service import hash_secret
from shared.a2a_client import A2AClient
from shared.auth import create_token
from subscriber import app as subscriber_app
from supervisor import app as supervisor_app


async def _set_up_db() -> None:
    database.db = database.InMemoryDatabase()
    await database.db.auth_keys.insert_one({
        "agent_id": "mcp_gateway_agent",
        "hashed_secret": hash_secret(os.environ["AGENT_SECRET"]),
        "role": "gateway",
    })
    await database.db.subscribers.insert_one({
        "imsi": "001010123456789",
        "name": "Test Subscriber",
        "qos_class": "QCI_1_URLLC",
        "service_plan": "6G_ROBOTICS_SLICE",
    })


@pytest.mark.asyncio
async def test_long_agent_secret_is_hashed_and_verified_without_truncation():
    secret = "machine-credential-" + ("x" * 256)
    hashed = hash_secret(secret)
    from auth_service import verify_secret
    assert verify_secret(secret, hashed)
    assert not verify_secret(secret + "different", hashed)


@pytest.mark.asyncio
@pytest.mark.parametrize("app,path", [(subscriber_app, "/lookup"), (supervisor_app, "/task")])
async def test_a2a_endpoint_rejects_missing_or_invalid_credentials(app, path):
    await _set_up_db()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        missing = await http.post(path, json={"jsonrpc": "2.0", "method": "lookup", "params": {}})
        invalid = await http.post(
            path,
            json={"jsonrpc": "2.0", "method": "lookup", "params": {}},
            headers={"Authorization": "Bearer invalid", "X-Agent-Id": "mcp_gateway_agent"},
        )
    assert missing.status_code == 401
    assert invalid.status_code == 401


@pytest.mark.asyncio
async def test_subscriber_accepts_valid_mcp_service_token():
    await _set_up_db()
    token = create_token("mcp_gateway_agent", "gateway")
    transport = httpx.ASGITransport(app=subscriber_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        response = await http.post(
            "/lookup",
            json={"jsonrpc": "2.0", "method": "lookup", "params": {"imsi": "001010123456789"}},
            headers={"Authorization": f"Bearer {token}", "X-Agent-Id": "mcp_gateway_agent"},
        )
    assert response.status_code == 200
    assert response.json()["result"]["qos_class"] == "QCI_1_URLLC"


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["http://a2a.test/subscriber", "http://a2a.test/supervisor"])
async def test_mcp_a2a_client_sends_bearer_and_matching_agent_id(monkeypatch, target):
    """The MCP identity must authenticate before either downstream target."""
    observed = []

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/auth/login":
            return httpx.Response(200, json={"access_token": create_token("mcp_gateway_agent", "gateway")})
        observed.append(request)
        return httpx.Response(200, json={"jsonrpc": "2.0", "result": {}})

    transport = httpx.MockTransport(handler)
    real_async_client = httpx.AsyncClient
    monkeypatch.setattr(
        "shared.a2a_client.httpx.AsyncClient",
        lambda **kwargs: real_async_client(transport=transport, **kwargs),
    )
    client = A2AClient("mcp_gateway_agent", os.environ["AGENT_SECRET"])
    await client.send(target, "lookup", {"imsi": "001010123456789"})
    assert len(observed) == 1
    assert observed[0].headers["X-Agent-Id"] == "mcp_gateway_agent"
    assert observed[0].headers["Authorization"].startswith("Bearer ")
