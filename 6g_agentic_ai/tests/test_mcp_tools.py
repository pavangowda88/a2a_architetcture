"""
Tests for the FastMCP 6G Core Network gateway.

Calls MCP tool functions directly (bypassing the MCP Client transport layer)
to avoid anyio task-group compatibility issues with pytest-asyncio.
A2A calls are mocked with unittest.mock.
"""

from __future__ import annotations

import json
import os
import sys

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

# Ensure the 6g_agentic_ai package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Patch settings before importing mcp_server so it doesn't need a real .env
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")
os.environ.setdefault("MCP_SERVER_CLIENT_SECRET", "mcp-secret")

import httpx
from mcp_server import (
    mcp,
    _client,
    attach_ue,
    request_ue_service,
    send_ue_message,
    broadcast_ue_message,
    get_ue_inbox,
    find_agent,
    find_agent_by_skill,
    list_active_sessions,
    get_subscriber_profile,
    run_supervisor_workflow,
    resource_topology,
    diagnose_network_issue,
)


# ---------------------------------------------------------------------------
# Helper: build mock A2A responses
# ---------------------------------------------------------------------------

def _auth_success_response():
    return {
        "jsonrpc": "2.0",
        "result": {
            "status": "completed",
            "result": {
                "authenticated": True,
                "authentication_method": "Agent-AKA",
                "imsi": "001010123456789",
                "trustScore": 91,
                "riskLevel": "LOW",
                "auth_vectors": {
                    "RAND": "abcd1234",
                    "AUTN": "efgh5678",
                    "XRES": "ijkl9012",
                },
                "automated_recovery": None,
            },
        },
        "id": "test-1",
    }


def _qos_response():
    return {
        "jsonrpc": "2.0",
        "result": {
            "imsi": "001010123456789",
            "name": "Test Subscriber",
            "qos_class": "QCI_1_URLLC",
            "service_plan": "6G_ROBOTICS_SLICE",
        },
        "id": "test-2",
    }


def _service_response():
    return {
        "jsonrpc": "2.0",
        "result": {
            "status": "completed",
            "service": "video_call",
            "qos_class": "QCI_1_URLLC",
            "service_plan": "6G_ROBOTICS_SLICE",
        },
        "id": "test-3",
    }


def _agent_card_response():
    return {
        "name": "UE Agent 001",
        "url": "http://localhost:8004",
        "skills": [{"id": "attach", "name": "Attach", "description": "6G attach", "endpoint": "/attach"}],
        "metadata": {"agent_type": "ue"},
    }


def _sessions_response_data():
    return {
        "jsonrpc": "2.0",
        "result": [
            {"imsi": "001010123456789", "session_id": "opaque-session-id", "service": "video_call", "status": "active"},
        ],
        "id": "sessions_query",
    }


# ═══════════════════════════════════════════════════════════════════════════
# INPUT VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestInputValidation:
    """Verify that tools reject bad inputs before making any A2A calls."""

    @pytest.mark.asyncio
    async def test_attach_ue_empty_imsi(self):
        result = await attach_ue(imsi="", imei="imei-123")
        assert result["success"] is False
        assert "imsi" in result["error"].lower()
        assert result["stage"] == "validation"

    @pytest.mark.asyncio
    async def test_attach_ue_empty_imei(self):
        result = await attach_ue(imsi="001", imei="")
        assert result["success"] is False
        assert "imei" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_send_message_same_sender_recipient(self):
        result = await send_ue_message(
            sender_id="ue_agent_001",
            recipient_id="ue_agent_001",
            topic="test",
            content="hello",
        )
        assert result["success"] is False
        assert "different" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_send_message_empty_sender(self):
        result = await send_ue_message(
            sender_id="",
            recipient_id="ue_agent_002",
            topic="test",
            content="hello",
        )
        assert result["success"] is False
        assert "sender_id" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_run_workflow_empty_goal(self):
        result = await run_supervisor_workflow(goal="")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_run_workflow_unrecognized_goal(self):
        result = await run_supervisor_workflow(goal="launch rocket")
        assert result["success"] is False
        assert "unrecognized" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_get_subscriber_empty_imsi(self):
        result = await get_subscriber_profile(imsi="")
        assert result["success"] is False
        assert "imsi" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_find_agent_empty_id(self):
        result = await find_agent(agent_id="")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_find_agent_by_skill_empty(self):
        result = await find_agent_by_skill(skill_id="")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_get_inbox_empty_agent_id(self):
        result = await get_ue_inbox(ue_agent_id="")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_broadcast_empty_sender(self):
        result = await broadcast_ue_message(sender_id="", topic="test", content="hello")
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_request_service_empty_service_type(self):
        result = await request_ue_service(imsi="001", imei="imei-1", service_type="")
        assert result["success"] is False
        assert "service_type" in result["error"].lower()


# ═══════════════════════════════════════════════════════════════════════════
# MOCKED A2A SUCCESS TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestMockedSuccess:
    """Verify tools return structured results when A2A calls succeed."""

    @pytest.mark.asyncio
    async def test_attach_ue_success(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock) as mock_send, \
             patch.object(_client, "get_access_token", new_callable=AsyncMock, return_value="tok"):
            # First call: orchestrate/authenticate_subscriber
            # Second call: qos/lookup
            mock_send.side_effect = [_auth_success_response(), _qos_response()]

            result = await attach_ue(imsi="001010123456789", imei="imei-123456789")

            assert result["success"] is True
            assert result["authenticated"] is True
            assert result["trust_score"] == 91
            assert result["risk_level"] == "LOW"
            assert "session_id" not in result
            assert result["qos_class"] == "QCI_1_URLLC"
            assert result["service_plan"] == "6G_ROBOTICS_SLICE"

    @pytest.mark.asyncio
    async def test_request_service_success(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock, return_value=_service_response()), \
             patch.object(_client, "get_access_token", new_callable=AsyncMock, return_value="tok"):
            result = await request_ue_service(
                imsi="001010123456789", imei="imei-123456789", service_type="video_call"
            )
            assert result["success"] is True
            assert result["service"] == "video_call"
            assert result["qos_class"] == "QCI_1_URLLC"

    @pytest.mark.asyncio
    async def test_find_agent_success(self):
        with patch.object(_client, "find_agent_by_id", new_callable=AsyncMock, return_value=_agent_card_response()):
            result = await find_agent(agent_id="ue_agent_001")
            assert result["success"] is True
            assert result["agent"]["name"] == "UE Agent 001"

    @pytest.mark.asyncio
    async def test_find_agent_by_skill_success(self):
        with patch.object(_client, "find_agent", new_callable=AsyncMock, return_value={
            "agent_id": "supervisor_agent",
            "name": "Supervisor Agent",
            "url": "http://localhost:8000/task",
            "skill": {"id": "orchestrate"},
            "card": _agent_card_response(),
        }):
            result = await find_agent_by_skill(skill_id="orchestrate")
            assert result["success"] is True
            assert result["agent_id"] == "supervisor_agent"

    @pytest.mark.asyncio
    async def test_get_subscriber_profile_success(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock, return_value=_qos_response()), \
             patch.object(_client, "get_access_token", new_callable=AsyncMock, return_value="tok"):
            result = await get_subscriber_profile(imsi="001010123456789")
            assert result["success"] is True
            assert result["qos_class"] == "QCI_1_URLLC"
            assert result["service_plan"] == "6G_ROBOTICS_SLICE"

    @pytest.mark.asyncio
    async def test_list_sessions_tokens_redacted(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = _sessions_response_data()

        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_resp)
        mock_http_client.__aenter__ = AsyncMock(return_value=mock_http_client)
        mock_http_client.__aexit__ = AsyncMock(return_value=False)

        with patch.object(_client, "get_access_token", new_callable=AsyncMock, return_value="tok"), \
             patch("mcp_server.httpx.AsyncClient", return_value=mock_http_client):
            result = await list_active_sessions()
            assert result["success"] is True
            # Verify session tokens are redacted
            for session in result.get("sessions", []):
                assert "session_id" not in session

    @pytest.mark.asyncio
    async def test_run_workflow_attach(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock, return_value=_auth_success_response()), \
             patch.object(_client, "get_access_token", new_callable=AsyncMock, return_value="tok"):
            result = await run_supervisor_workflow(
                goal="attach UE",
                params={"imsi": "001010123456789", "imei": "imei-123456789"},
            )
            assert result["success"] is True
            assert result["method"] == "authenticate_subscriber"


# ═══════════════════════════════════════════════════════════════════════════
# MOCKED A2A FAILURE TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestMockedFailure:
    """Verify tools handle A2A errors gracefully."""

    @pytest.mark.asyncio
    async def test_attach_ue_supervisor_unreachable(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock,
                          side_effect=Exception("Connection refused")):
            result = await attach_ue(imsi="001010123456789", imei="imei-123456789")
            assert result["success"] is False
            assert result["stage"] == "supervisor"

    @pytest.mark.asyncio
    async def test_find_agent_not_found(self):
        mock_response = MagicMock()
        mock_response.status_code = 404
        with patch.object(_client, "find_agent_by_id", new_callable=AsyncMock,
                          side_effect=httpx.HTTPStatusError(
                              "Not Found", request=MagicMock(), response=mock_response
                          )):
            result = await find_agent(agent_id="nonexistent_agent")
            assert result["success"] is False
            assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_get_subscriber_not_found(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock, return_value={
            "jsonrpc": "2.0",
            "error": {"code": 404, "message": "Subscriber not found"},
            "id": "test",
        }):
            result = await get_subscriber_profile(imsi="999999999")
            assert result["success"] is False
            assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_find_skill_not_found(self):
        mock_response = MagicMock()
        mock_response.status_code = 404
        with patch.object(_client, "find_agent", new_callable=AsyncMock,
                          side_effect=httpx.HTTPStatusError(
                              "Not Found", request=MagicMock(), response=mock_response
                          )):
            result = await find_agent_by_skill(skill_id="nonexistent_skill")
            assert result["success"] is False
            assert "no agent found" in result["error"].lower() or "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_inbox_agent_not_found(self):
        with patch.object(_client, "find_agent_by_id", new_callable=AsyncMock,
                          side_effect=Exception("Agent not found")):
            result = await get_ue_inbox(ue_agent_id="nonexistent_ue")
            assert result["success"] is False
            assert result["stage"] == "registry"

    @pytest.mark.asyncio
    async def test_request_service_supervisor_down(self):
        with patch.object(_client, "send_by_skill", new_callable=AsyncMock,
                          side_effect=httpx.ConnectError("Connection refused")):
            result = await request_ue_service(imsi="001", imei="imei-1", service_type="video_call")
            assert result["success"] is False
            assert "unreachable" in result["error"].lower()


# ═══════════════════════════════════════════════════════════════════════════
# RESOURCE AND PROMPT TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestResourcesAndPrompts:
    """Verify MCP resources and prompts return valid data."""

    @pytest.mark.asyncio
    async def test_topology_resource(self):
        result = await resource_topology()
        data = json.loads(result)
        assert "services" in data
        assert data["transport"] == "Streamable HTTP"
        assert data["mcp_endpoint"] == "http://localhost:8010/mcp"
        assert len(data["services"]) == 10

    def test_diagnose_attachment(self):
        prompt = diagnose_network_issue(issue_type="attachment", imsi="001010123456789")
        assert "attach_ue" in prompt
        assert "001010123456789" in prompt
        assert "Supervisor" in prompt

    def test_diagnose_authentication(self):
        prompt = diagnose_network_issue(issue_type="authentication")
        assert "AUSF" in prompt or "auth" in prompt
        assert "low-trust" in prompt.lower() or "simulate_low_trust" in prompt

    def test_diagnose_qos(self):
        prompt = diagnose_network_issue(issue_type="qos")
        assert "get_subscriber_profile" in prompt
        assert "request_ue_service" in prompt

    def test_diagnose_registry(self):
        prompt = diagnose_network_issue(issue_type="registry")
        assert "agent-cards" in prompt or "agent_cards" in prompt or "topology" in prompt

    def test_diagnose_messaging(self):
        prompt = diagnose_network_issue(issue_type="messaging")
        assert "send_ue_message" in prompt
        assert "get_ue_inbox" in prompt

    def test_diagnose_unknown_type(self):
        prompt = diagnose_network_issue(issue_type="unknown_type")
        assert "Unknown" in prompt or "unknown" in prompt

    def test_mcp_server_name(self):
        """Verify the FastMCP server is configured correctly."""
        assert mcp.name == "6G-Core-Network"
