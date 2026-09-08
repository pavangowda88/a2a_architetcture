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
import database
import ue
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
    assign_task as assign_task_tool,
    list_agents_by_skill,
    end_task_session,
    end_all_task_sessions,
)
import mcp_server


@pytest.mark.asyncio
async def test_ue_task_endpoint_accepts_pick_and_place():
    transport = httpx.ASGITransport(app=ue.app)
    request = {
        "jsonrpc": "2.0",
        "id": "test-1",
        "method": "assign_task",
        "params": {
            "agent_id": "robot_test_001",
            "skill": "pick_and_place",
            "task": "Move the test package to station B",
            "payload_kg": 2,
            "payload": {"source": "station-A", "destination": "station-B"},
        },
    }

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        with patch.object(ue, "require_oauth_scope", new=AsyncMock()):
            response = await client.post("/task", json=request)

    assert response.status_code == 200
    assert response.json()["result"]["accepted"] is True
    assert response.json()["result"]["payload_kg"] == 2.0


@pytest.mark.asyncio
async def test_ue_inbox_includes_accepted_tasks():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    await database.db.tasks.insert_one({
        "agent_id": ue.AGENT_ID,
        "skill": "pick_and_place",
        "task": "Move the test package to station B",
        "payload_kg": 2.0,
        "payload": {"source": "station-A", "destination": "station-B"},
        "status": "accepted",
    })

    try:
        transport = httpx.ASGITransport(app=ue.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            with patch.object(ue, "require_oauth_scope", new=AsyncMock()):
                response = await client.get("/inbox")
    finally:
        database.db = previous_db

    assert response.status_code == 200
    task_items = [item for item in response.json()["result"] if item.get("type") == "task"]
    assert len(task_items) == 1
    assert task_items[0]["task"] == "Move the test package to station B"


@pytest.mark.asyncio
async def test_robot_tasks_queue_and_end_session_promotes_next_task():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    request = {
        "jsonrpc": "2.0",
        "id": "queue-test",
        "method": "assign_task",
        "params": {
            "agent_id": "robot_test_001",
            "skill": "pick_and_place",
            "task": "Move package",
            "payload_kg": 2,
            "locations": {"source": "station-A", "destination": "station-B"},
        },
    }

    try:
        transport = httpx.ASGITransport(app=ue.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            with patch.object(ue, "require_oauth_scope", new=AsyncMock()):
                first_response = await client.post("/task", json=request)
                second_response = await client.post("/task", json=request)

        first = first_response.json()["result"]
        second = second_response.json()["result"]
        assert first["status"] == "active"
        assert second["status"] == "queued"

        ended = await end_task_session(first["session_id"])
        assert ended["success"] is True
        assert ended["next_task_id"] == second["task_id"]
        active = await database.db.tasks.find_one({"task_id": second["task_id"]})
        assert active["status"] == "active"

        closed = await end_all_task_sessions("robot_test_001")
        assert closed["ended_count"] == 1
    finally:
        database.db = previous_db


@pytest.mark.asyncio
async def test_assign_task_selects_least_loaded_capable_robot():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    await database.db.tasks.insert_one({"agent_id": "robot-b", "status": "active"})
    cards = [
        {"id": "robot-a", "url": "http://robot-a", "skills": [{"id": "pick_and_place", "endpoint": "/task"}], "metadata": {"max_payload_kg": 5}},
        {"id": "robot-b", "url": "http://robot-b", "skills": [{"id": "pick_and_place", "endpoint": "/task"}], "metadata": {"max_payload_kg": 10}},
    ]
    try:
        with patch.object(_client, "list_agents", new_callable=AsyncMock, return_value=cards), \
             patch.object(_client, "send_raw", new_callable=AsyncMock, return_value={"result": {"accepted": True}}):
            result = await assign_task_tool(
                task="Move package to station B",
                payload_kg=3,
                locations={"source": "station-A", "destination": "station-B"},
            )
        assert result["success"] is True
        assert result["agent_id"] == "robot-a"
    finally:
        database.db = previous_db


@pytest.mark.asyncio
async def test_assign_task_rejects_job_that_does_not_match_selected_skill():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    card = {
        "id": "robot-a",
        "url": "http://robot-a",
        "skills": [{"id": "pick_and_place", "endpoint": "/task"}],
        "metadata": {"max_payload_kg": 5},
    }
    try:
        with patch.object(_client, "find_agent_by_id", new_callable=AsyncMock, return_value=card):
            result = await assign_task_tool(
                agent_id="robot-a",
                skill="pick_and_place",
                task="Crush package A11",
            )
        assert result["success"] is False
        assert result["stage"] == "validation"
        assert "does not match" in result["error"]
    finally:
        database.db = previous_db


@pytest.mark.asyncio
async def test_assign_task_auto_selection_requires_matching_skill():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    cards = [
        {"id": "picker", "url": "http://picker", "skills": [{"id": "pick_and_place", "endpoint": "/task"}], "metadata": {"max_payload_kg": 5}},
        {"id": "crusher", "url": "http://crusher", "skills": [{"id": "crush", "endpoint": "/task"}], "metadata": {"max_payload_kg": 5}},
    ]
    try:
        with patch.object(_client, "list_agents", new_callable=AsyncMock, return_value=cards), \
             patch.object(_client, "send_raw", new_callable=AsyncMock, return_value={"result": {"accepted": True}}):
            result = await assign_task_tool(task="Crush package A11", payload_kg=1)
        assert result["success"] is True
        assert result["agent_id"] == "crusher"
    finally:
        database.db = previous_db


@pytest.mark.asyncio
async def test_register_reports_started_robot_task_endpoint():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    card_response = {"success": True}
    try:
        with patch.object(_client, "register", new_callable=AsyncMock, return_value=card_response), \
             patch.object(mcp_server, "_provision_robot_endpoint", new_callable=AsyncMock, return_value={"status": "started", "pid": 1234}), \
             patch.object(mcp_server, "_record_session", new_callable=AsyncMock, return_value={"status": "active"}):
            result = await mcp_server.register(
                agent_id="robot-weld-test",
                agent_name="Welding Test Robot",
                agent_type="welding_arm",
                imsi="001010000000199",
                imei="356938035643999",
                endpoint="http://localhost:8123",
                skills=["welding"],
                services=["manufacturing_slice"],
                metadata={"max_payload_kg": 15},
            )
        assert result["success"] is True
        assert result["endpoint"]["status"] == "started"
    finally:
        database.db = previous_db

    @pytest.mark.asyncio
    async def test_register_existing_agent_returns_authentication_next_action(self):
        previous_db = database.db
        database.db = database.InMemoryDatabase()
        existing_card = {
            "id": "robot-existing",
            "name": "Existing Robot",
            "url": "http://localhost:8123",
            "skills": [{"id": "inspection"}],
            "metadata": {"agent_type": "industrial_arm"},
        }
        try:
            with patch.object(_client, "find_agent_by_id", new_callable=AsyncMock, return_value=existing_card), \
                 patch.object(mcp_server, "_record_session", new_callable=AsyncMock, return_value={"status": "active"}), \
                 patch.object(_client, "register", new_callable=AsyncMock) as register_mock:
                result = await mcp_server.register(
                    agent_id="robot-existing",
                    agent_name="Replacement Name",
                    agent_type="industrial_arm",
                    imsi="001010000000199",
                    imei="356938035643999",
                    endpoint="http://localhost:8123",
                    skills=["inspection"],
                    services=[],
                )
            assert result["success"] is True
            assert result["already_registered"] is True
            assert result["next_action"] == "authenticate"
            assert result["agent"]["name"] == "Existing Robot"
            register_mock.assert_not_called()
        finally:
            database.db = previous_db


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
    async def test_list_agents_by_skill_returns_all_matching_agents(self):
        previous_db = database.db
        database.db = database.InMemoryDatabase()
        cards = [
            {"id": "robot-1", "name": "Robot 1", "skills": [{"id": "inspection"}], "metadata": {"agent_type": "industrial_arm"}},
            {"id": "robot-2", "name": "Robot 2", "skills": [{"id": "inspection"}], "metadata": {"agent_type": "industrial_arm"}},
            {"id": "ue-1", "name": "UE 1", "skills": [{"id": "attach"}]},
        ]
        try:
            with patch.object(_client, "list_agents", new_callable=AsyncMock, return_value=cards), \
                 patch.object(mcp_server, "_record_session", new_callable=AsyncMock, return_value={"status": "active"}):
                result = await list_agents_by_skill(skill="inspection")
            assert result["success"] is True
            assert result["count"] == 2
            assert {agent["id"] for agent in result["agents"]} == {"robot-1", "robot-2"}
        finally:
            database.db = previous_db

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
