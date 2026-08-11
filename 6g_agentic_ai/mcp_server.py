"""
FastMCP Gateway — Streamable HTTP server that lets LLM clients operate the
6G Agentic AI Core Network through typed MCP tools, resources, and prompts.

All operations delegate to the existing Supervisor and A2A services.
No business logic is duplicated; no secrets are ever exposed.

Run:
    python mcp_server.py
    # or: fastmcp run mcp_server.py --transport streamable-http --port 8010
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from fastmcp import FastMCP

from shared.a2a_client import A2AClient
from shared.config import settings

# ---------------------------------------------------------------------------
# FastMCP instance
# ---------------------------------------------------------------------------
mcp = FastMCP(
    name="6G-Core-Network",
    instructions=(
        "MCP gateway for a 6G Agentic AI Core Network. "
        "Tools let you attach UEs, request services, send messages, "
        "query the agent registry, and run supervisor workflows. "
        "All operations are orchestrated through the Supervisor agent."
    ),
)

# ---------------------------------------------------------------------------
# Internal A2A client — authenticates as the MCP gateway agent
# ---------------------------------------------------------------------------
_client = A2AClient(agent_id="mcp_gateway_agent", agent_secret=settings.AGENT_SECRET)

# Port topology for the static topology resource
_TOPOLOGY = {
    "services": [
        {"name": "Auth Service",         "port": 9000, "skills": ["login", "verify"],                     "role": "JWT token issuer / verifier"},
        {"name": "Registry Service",     "port": 9001, "skills": ["discovery"],                           "role": "Agent Card directory and skill-based discovery"},
        {"name": "Supervisor Agent",     "port": 8000, "skills": ["orchestrate"],                         "role": "Central orchestrator for attach, service requests, and profile queries"},
        {"name": "AUSF Agent",           "port": 8001, "skills": ["auth", "verify-session"],              "role": "Agent-AKA authentication with automated low-trust recovery"},
        {"name": "Subscriber Agent",     "port": 8002, "skills": ["qos", "session"],                      "role": "QoS lookup and session management"},
        {"name": "UDM Agent",            "port": 8003, "skills": ["sub-data", "auth-vectors", "ue-profile", "af-profile", "reverify-sub"], "role": "Unified Data Management"},
        {"name": "Security Agent",       "port": 8005, "skills": ["trust", "re-evaluate"],                "role": "Trust scoring and risk assessment"},
        {"name": "Notification Agent",   "port": 8006, "skills": ["card-notify"],                         "role": "Forwards Agent Card changes to supervisor"},
        {"name": "UE Agent 001",         "port": 8004, "skills": ["attach", "service-request", "peer-message", "ue-profile-local"], "role": "User Equipment agent instance"},
        {"name": "UE Agent 002",         "port": 8007, "skills": ["attach", "service-request", "peer-message", "ue-profile-local"], "role": "User Equipment agent instance"},
        {"name": "FastMCP Gateway",      "port": 8010, "skills": ["mcp-tools"],                           "role": "LLM-facing MCP tool gateway (this server)"},
    ],
    "transport": "Streamable HTTP",
    "mcp_endpoint": "http://localhost:8010/mcp",
}


# ═══════════════════════════════════════════════════════════════════════════
# Helper utilities
# ═══════════════════════════════════════════════════════════════════════════

def _sanitize_card(card: dict) -> dict:
    """Strip MongoDB _id and any embedded secrets from an agent card."""
    card.pop("_id", None)
    card.pop("securitySchemes", None)
    card.pop("security", None)
    return card


def _sanitize_session(session: dict) -> dict:
    """Redact session tokens from session data returned to the LLM."""
    session.pop("_id", None)
    session.pop("session_token", None)
    return session


def _error(message: str, stage: str = "unknown") -> dict:
    """Return a structured error dict for MCP tool responses."""
    return {"success": False, "error": message, "stage": stage}


async def _safe_call(coro, stage: str) -> dict:
    """Execute an async A2A call with uniform error handling."""
    try:
        result = await coro
        if isinstance(result, dict) and "error" in result:
            err = result["error"]
            msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
            return _error(msg, stage)
        return result
    except httpx.HTTPStatusError as exc:
        return _error(f"Service returned HTTP {exc.response.status_code}", stage)
    except httpx.ConnectError:
        return _error("Service unreachable — is it running?", stage)
    except Exception as exc:
        return _error(str(exc), stage)


async def _get_ue_base_url(agent_id: str) -> str | None:
    """Resolve a UE agent's base URL from the Registry."""
    try:
        card = await _client.find_agent_by_id(agent_id)
        return card.get("url", "").rstrip("/")
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# MCP TOOLS
# ═══════════════════════════════════════════════════════════════════════════

@mcp.tool(
    description=(
        "Attach a UE to the 6G core network. Delegates to the Supervisor which "
        "orchestrates AUSF → UDM → Security → Subscriber autonomously. "
        "Returns authentication status, trust score, risk level, session token, "
        "QoS class, service plan, and any automated recovery details."
    )
)
async def attach_ue(
    imsi: str,
    imei: str,
    simulate_low_trust: bool = False,
) -> dict:
    """End-to-end 6G network attach via Agent-AKA authentication."""
    if not imsi or not imsi.strip():
        return _error("imsi is required and cannot be empty", "validation")
    if not imei or not imei.strip():
        return _error("imei is required and cannot be empty", "validation")

    resp = await _safe_call(
        _client.send_by_skill("orchestrate", "authenticate_subscriber", {
            "imsi": imsi.strip(),
            "imei": imei.strip(),
            "simulate_low_trust": simulate_low_trust,
        }),
        stage="supervisor",
    )
    if not resp.get("success", True) is True and "error" in resp:
        return resp

    result = resp.get("result", resp)
    inner = result.get("result", result) if isinstance(result, dict) else result

    # Build clean aggregated response
    output: dict[str, Any] = {
        "success": result.get("status") == "completed",
        "authenticated": inner.get("authenticated", False),
        "authentication_method": inner.get("authentication_method"),
        "imsi": imsi,
        "trust_score": inner.get("trustScore"),
        "risk_level": inner.get("riskLevel"),
    }

    # Include session token only when supervisor explicitly provides it
    if inner.get("session_token"):
        output["session_token"] = inner["session_token"]

    if inner.get("automated_recovery"):
        output["automated_recovery"] = inner["automated_recovery"]

    # Fetch QoS data for a complete aggregated result
    qos_resp = await _safe_call(
        _client.send_by_skill("qos", "lookup", {"imsi": imsi.strip()}),
        stage="subscriber",
    )
    if isinstance(qos_resp, dict) and qos_resp.get("result"):
        qos = qos_resp["result"]
        output["qos_class"] = qos.get("qos_class")
        output["service_plan"] = qos.get("service_plan")

    return output


@mcp.tool(
    description=(
        "Request a network service for a UE. Delegates to the Supervisor which "
        "looks up QoS and service plan from the Subscriber agent. "
        "Returns service type, QoS class, and service plan."
    )
)
async def request_ue_service(
    imsi: str,
    imei: str,
    service_type: str,
) -> dict:
    """Request a service (e.g. video_call, robotics_slice) under an active session."""
    if not imsi or not imsi.strip():
        return _error("imsi is required", "validation")
    if not service_type or not service_type.strip():
        return _error("service_type is required", "validation")

    resp = await _safe_call(
        _client.send_by_skill("orchestrate", "service_request", {
            "imsi": imsi.strip(),
            "imei": (imei or "").strip(),
            "service_type": service_type.strip(),
        }),
        stage="supervisor",
    )
    if "error" in resp and not resp.get("success", True):
        return resp

    result = resp.get("result", resp)
    return {
        "success": result.get("status") == "completed",
        "service": result.get("service", service_type),
        "qos_class": result.get("qos_class"),
        "service_plan": result.get("service_plan"),
        "status": result.get("status"),
    }


@mcp.tool(
    description=(
        "Send an A2A peer message from one UE to another. "
        "Discovers the sender UE through the Registry and uses its "
        "/send-message endpoint to deliver the message."
    )
)
async def send_ue_message(
    sender_id: str,
    recipient_id: str,
    topic: str,
    content: dict | str,
) -> dict:
    """Direct UE-to-UE A2A message delivery."""
    if not sender_id or not sender_id.strip():
        return _error("sender_id is required", "validation")
    if not recipient_id or not recipient_id.strip():
        return _error("recipient_id is required", "validation")
    if sender_id.strip() == recipient_id.strip():
        return _error("sender_id and recipient_id must be different", "validation")

    base_url = await _get_ue_base_url(sender_id.strip())
    if not base_url:
        return _error(f"UE agent '{sender_id}' not found in registry", "registry")

    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-send-msg",
        "params": {
            "recipient": recipient_id.strip(),
            "topic": topic or "general",
            "content": content,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(f"{base_url}/send-message", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {"success": True, **data.get("result", data)}
    except httpx.HTTPStatusError as exc:
        return _error(f"Send failed with HTTP {exc.response.status_code}", "ue_agent")
    except Exception as exc:
        return _error(str(exc), "ue_agent")


@mcp.tool(
    description=(
        "Broadcast an A2A message from one UE to every other registered UE. "
        "Uses the sender UE's /broadcast endpoint."
    )
)
async def broadcast_ue_message(
    sender_id: str,
    topic: str,
    content: dict | str,
) -> dict:
    """Broadcast a message to all UE peers via the sender's broadcast endpoint."""
    if not sender_id or not sender_id.strip():
        return _error("sender_id is required", "validation")

    base_url = await _get_ue_base_url(sender_id.strip())
    if not base_url:
        return _error(f"UE agent '{sender_id}' not found in registry", "registry")

    payload = {
        "jsonrpc": "2.0",
        "id": "mcp-broadcast",
        "params": {
            "topic": topic or "broadcast",
            "content": content,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            resp = await http.post(f"{base_url}/broadcast", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return {"success": True, **data.get("result", data)}
    except httpx.HTTPStatusError as exc:
        return _error(f"Broadcast failed with HTTP {exc.response.status_code}", "ue_agent")
    except Exception as exc:
        return _error(str(exc), "ue_agent")


@mcp.tool(
    description=(
        "Retrieve the message inbox for a specific UE agent. "
        "Returns all messages received by that UE."
    )
)
async def get_ue_inbox(ue_agent_id: str) -> dict:
    """Fetch the inbox of a UE agent by querying its /inbox endpoint."""
    if not ue_agent_id or not ue_agent_id.strip():
        return _error("ue_agent_id is required", "validation")

    base_url = await _get_ue_base_url(ue_agent_id.strip())
    if not base_url:
        return _error(f"UE agent '{ue_agent_id}' not found in registry", "registry")

    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(f"{base_url}/inbox")
            resp.raise_for_status()
            data = resp.json()
            messages = data.get("result", [])
            return {"success": True, "agent_id": ue_agent_id.strip(), "messages": messages, "count": len(messages)}
    except Exception as exc:
        return _error(str(exc), "ue_agent")


@mcp.tool(
    description="Look up a specific agent's card by its agent ID from the Registry."
)
async def find_agent(agent_id: str) -> dict:
    """Resolve an agent card by ID."""
    if not agent_id or not agent_id.strip():
        return _error("agent_id is required", "validation")

    try:
        card = await _client.find_agent_by_id(agent_id.strip())
        return {"success": True, "agent": _sanitize_card(card)}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return _error(f"Agent '{agent_id}' not found", "registry")
        return _error(f"Registry returned HTTP {exc.response.status_code}", "registry")
    except Exception as exc:
        return _error(str(exc), "registry")


@mcp.tool(
    description=(
        "Discover an agent that advertises a specific skill. "
        "Returns the agent card, skill details, and the resolved endpoint URL."
    )
) 
async def find_agent_by_skill(skill_id: str) -> dict:
    """Find an agent by its advertised skill ID."""
    if not skill_id or not skill_id.strip():
        return _error("skill_id is required", "validation")

    try:
        info = await _client.find_agent(skill_id.strip())
        info.pop("_id", None)
        if "card" in info:
            info["card"] = _sanitize_card(info["card"])
        return {"success": True, **info}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return _error(f"No agent found for skill '{skill_id}'", "registry")
        return _error(f"Registry returned HTTP {exc.response.status_code}", "registry")
    except Exception as exc:
        return _error(str(exc), "registry")


@mcp.tool(
    description=(
        "List all active UE sessions from the Supervisor agent. "
        "Session tokens are redacted for security."
    )
)
async def list_active_sessions() -> dict:
    """Query the Supervisor for active subscriber sessions."""
    try:
        token = await _client.authenticate()
        headers = _client._headers(token)
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(
                f"{settings.BASE_URI}:8000/sessions",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            sessions = data.get("result", [])
            sanitized = [_sanitize_session(dict(s)) for s in sessions]
            return {"success": True, "sessions": sanitized, "count": len(sanitized)}
    except Exception as exc:
        return _error(str(exc), "supervisor")


@mcp.tool(
    description=(
        "Get a subscriber's QoS class and service plan by IMSI. "
        "Delegates to the Subscriber agent via A2A."
    )
)
async def get_subscriber_profile(imsi: str) -> dict:
    """Look up subscriber QoS and service plan."""
    if not imsi or not imsi.strip():
        return _error("imsi is required", "validation")

    resp = await _safe_call(
        _client.send_by_skill("qos", "lookup", {"imsi": imsi.strip()}),
        stage="subscriber",
    )
    if "error" in resp and not resp.get("success", True):
        return resp

    result = resp.get("result", resp)
    return {
        "success": True,
        "imsi": result.get("imsi", imsi),
        "name": result.get("name"),
        "qos_class": result.get("qos_class"),
        "service_plan": result.get("service_plan"),
    }


@mcp.tool(
    description=(
        "Submit a high-level goal to the Supervisor agent. Translates natural-"
        "language intents like 'attach UE', 'request video_call service', or "
        "'get UE profile' into the correct Supervisor task method and returns "
        "an aggregated result."
    )
)
async def run_supervisor_workflow(
    goal: str,
    params: dict | None = None,
) -> dict:
    """Run a supervisor workflow by mapping a high-level goal to task methods."""
    if not goal or not goal.strip():
        return _error("goal is required", "validation")

    goal_lower = goal.strip().lower()
    p = params or {}

    # ── Map goal to supervisor method ──────────────────────────────────
    if any(kw in goal_lower for kw in ("attach", "authenticate", "connect ue")):
        method = "authenticate_subscriber"
        task_params = {
            "imsi": p.get("imsi", ""),
            "imei": p.get("imei", ""),
            "simulate_low_trust": p.get("simulate_low_trust", False),
        }
        if not task_params["imsi"]:
            return _error("params.imsi is required for attach/authenticate goals", "validation")

    elif any(kw in goal_lower for kw in ("service", "request", "video", "robotics", "slice")):
        method = "service_request"
        task_params = {
            "imsi": p.get("imsi", ""),
            "service_type": p.get("service_type", "video_call"),
        }
        if not task_params["imsi"]:
            return _error("params.imsi is required for service request goals", "validation")

    elif any(kw in goal_lower for kw in ("profile", "ue profile", "get profile")):
        method = "get_ue_profile"
        task_params = {"agent_id": p.get("agent_id", "UE-Agent-001")}

    elif "diagnose" in goal_lower:
        # Run a diagnostic sequence: attach → service request → report
        diag: dict[str, Any] = {"goal": goal, "stages": {}}
        imsi = p.get("imsi", "001010123456789")
        imei = p.get("imei", "imei-123456789")

        # Stage 1: Check supervisor availability
        sup_check = await _safe_call(
            _client.find_agent("orchestrate"),
            stage="registry",
        )
        diag["stages"]["supervisor_discovery"] = (
            "ok" if isinstance(sup_check, dict) and sup_check.get("url") else "FAILED"
        )

        # Stage 2: Attempt attach
        attach_result = await attach_ue(imsi=imsi, imei=imei)
        diag["stages"]["attach"] = attach_result

        # Stage 3: Attempt service request
        svc_result = await request_ue_service(
            imsi=imsi, imei=imei,
            service_type=p.get("service_type", "video_call"),
        )
        diag["stages"]["service_request"] = svc_result

        # Stage 4: Check downstream agents
        for skill in ("auth", "trust", "qos"):
            check = await _safe_call(_client.find_agent(skill), stage="registry")
            diag["stages"][f"{skill}_agent_discovery"] = (
                "ok" if isinstance(check, dict) and check.get("url") else "FAILED"
            )

        diag["success"] = all(
            v != "FAILED" for v in diag["stages"].values()
            if isinstance(v, str)
        )
        return diag

    else:
        return _error(
            f"Unrecognized goal: '{goal}'. Supported goals: "
            "'attach UE', 'request service', 'get UE profile', 'diagnose attachment failure'.",
            "validation",
        )

    # ── Execute the supervisor task ────────────────────────────────────
    resp = await _safe_call(
        _client.send_by_skill("orchestrate", method, task_params),
        stage="supervisor",
    )
    if "error" in resp and not resp.get("success", True):
        return {"success": False, "goal": goal, "method": method, **resp}

    result = resp.get("result", resp)
    return {
        "success": True,
        "goal": goal,
        "method": method,
        "result": result,
    }


# ═══════════════════════════════════════════════════════════════════════════
# MCP RESOURCES
# ═══════════════════════════════════════════════════════════════════════════

@mcp.resource(
    "network://agent-cards",
    description="All registered Agent Cards from the 6G core network Registry.",
)
async def resource_agent_cards() -> str:
    """Return every registered agent card as JSON."""
    try:
        agents = await _client.list_agents()
        sanitized = [_sanitize_card(dict(a)) for a in agents]
        return json.dumps(sanitized, indent=2, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@mcp.resource(
    "network://active-sessions",
    description="Currently active UE sessions (session tokens redacted).",
)
async def resource_active_sessions() -> str:
    """Return active sessions with tokens redacted."""
    try:
        token = await _client.authenticate()
        headers = _client._headers(token)
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(
                f"{settings.BASE_URI}:8000/sessions",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            sessions = [_sanitize_session(dict(s)) for s in data.get("result", [])]
            return json.dumps(sessions, indent=2, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


@mcp.resource(
    "network://topology",
    description="Network topology: all services, ports, skills, and capabilities.",
)
async def resource_topology() -> str:
    """Static topology of the 6G core network services."""
    return json.dumps(_TOPOLOGY, indent=2)


# ═══════════════════════════════════════════════════════════════════════════
# MCP PROMPTS
# ═══════════════════════════════════════════════════════════════════════════

@mcp.prompt(
    description=(
        "Diagnostic prompt that guides an LLM through investigating "
        "a 6G network issue step by step."
    )
)
def diagnose_network_issue(
    issue_type: str,
    imsi: str = "001010123456789",
    agent_id: str = "",
) -> str:
    """Generate a step-by-step diagnostic plan for a 6G network issue.

    Args:
        issue_type: One of 'attachment', 'authentication', 'qos', 'registry', 'messaging'.
        imsi: The subscriber IMSI to investigate.
        agent_id: Optional agent ID relevant to the issue.
    """
    diagnostics = {
        "attachment": (
            f"You are diagnosing a UE attachment failure for IMSI {imsi}.\n\n"
            "Follow these steps:\n"
            "1. Call `find_agent_by_skill(skill_id='orchestrate')` to verify the Supervisor is registered and reachable.\n"
            "2. Call `find_agent_by_skill(skill_id='auth')` to verify the AUSF agent is online.\n"
            "3. Call `find_agent_by_skill(skill_id='auth-vectors')` to verify the UDM agent is available.\n"
            "4. Call `find_agent_by_skill(skill_id='trust')` to verify the Security agent is online.\n"
            f"5. Call `attach_ue(imsi='{imsi}', imei='imei-123456789')` and examine the result.\n"
            "6. If `authenticated` is False, check the `automated_recovery` field for low-trust recovery attempts.\n"
            "7. If trust_score < 70, the Security agent flagged the UE as high-risk. Check security logs.\n"
            "8. Report: authentication status, trust_score, risk_level, and any recovery actions taken."
        ),
        "authentication": (
            f"You are diagnosing an authentication issue for IMSI {imsi}.\n\n"
            "Follow these steps:\n"
            "1. Call `find_agent_by_skill(skill_id='auth')` to check AUSF availability.\n"
            "2. Call `find_agent_by_skill(skill_id='auth-vectors')` to check UDM (auth vector source).\n"
            f"3. Call `attach_ue(imsi='{imsi}', imei='imei-123456789', simulate_low_trust=True)` to test low-trust recovery.\n"
            "4. Examine the `automated_recovery` section — the AUSF should trigger UDM re-verification and Security re-evaluation.\n"
            "5. Compare trust_score before and after recovery.\n"
            "6. Report: whether Agent-AKA vectors were generated, trust score trajectory, and final auth status."
        ),
        "qos": (
            f"You are diagnosing a QoS/service plan issue for IMSI {imsi}.\n\n"
            "Follow these steps:\n"
            f"1. Call `get_subscriber_profile(imsi='{imsi}')` to retrieve current QoS class and service plan.\n"
            "2. Call `find_agent_by_skill(skill_id='qos')` to verify the Subscriber agent is online.\n"
            f"3. Call `request_ue_service(imsi='{imsi}', imei='imei-123456789', service_type='video_call')` to test service provisioning.\n"
            "4. Check if qos_class and service_plan are returned correctly.\n"
            "5. Call `list_active_sessions()` to verify the session is active.\n"
            "6. Report: subscriber profile, allocated QoS class, service plan, and session status."
        ),
        "registry": (
            "You are diagnosing a Registry / agent discovery issue.\n\n"
            "Follow these steps:\n"
            "1. Read the `network://agent-cards` resource to see all registered agents.\n"
            "2. Read the `network://topology` resource to see expected services and ports.\n"
            "3. Compare: are all expected agents registered?\n"
            + (f"4. Call `find_agent(agent_id='{agent_id}')` to check the specific agent.\n" if agent_id else
               "4. Call `find_agent_by_skill(skill_id='orchestrate')` to check the Supervisor.\n")
            + "5. For each missing agent, verify the service is running on its expected port.\n"
            "6. Report: which agents are registered, which are missing, and recommended actions."
        ),
        "messaging": (
            "You are diagnosing a UE-to-UE messaging failure.\n\n"
            "Follow these steps:\n"
            "1. Read the `network://agent-cards` resource and filter for agents with `metadata.agent_type == 'ue'`.\n"
            "2. Verify both sender and recipient UE agents are registered.\n"
            + (f"3. Call `get_ue_inbox(ue_agent_id='{agent_id or 'ue_agent_002'}')` to check if messages are being received.\n")
            + "4. Call `send_ue_message(sender_id='ue_agent_001', recipient_id='ue_agent_002', topic='test', content='ping')` to test delivery.\n"
            "5. Call `get_ue_inbox(ue_agent_id='ue_agent_002')` again — the test message should appear.\n"
            "6. If delivery failed, check that the sender UE can reach the recipient's /messages endpoint.\n"
            "7. Report: registry status, message delivery result, and inbox contents."
        ),
    }

    prompt = diagnostics.get(issue_type.lower().strip())
    if not prompt:
        return (
            f"Unknown issue_type '{issue_type}'. "
            f"Supported types: {', '.join(diagnostics.keys())}. "
            "Please call this prompt again with a valid issue_type."
        )
    return prompt


# ═══════════════════════════════════════════════════════════════════════════
# Entrypoint
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8010, path="/mcp")
