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
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastmcp import FastMCP
from fastmcp.server.auth import AccessToken, RemoteAuthProvider, TokenVerifier
from fastapi import HTTPException
from pydantic import AnyHttpUrl

from shared.a2a_client import A2AClient
from shared.config import settings
from shared.oauth import introspect_access_token
import database

logging.basicConfig(
    filename="mcp_server.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
if not any(isinstance(handler, logging.FileHandler) for handler in logger.handlers):
    logger.addHandler(logging.FileHandler("mcp_server.log"))
oauth_logger = logging.getLogger("shared.oauth")
if not any(isinstance(handler, logging.FileHandler) for handler in oauth_logger.handlers):
    oauth_logger.addHandler(logging.FileHandler("mcp_server.log"))


class KeycloakTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        logger.info(
            "MCP received Authorization token: present=%s length=%s",
            bool(token),
            len(token) if token else 0,
        )

        try:
            claims = await introspect_access_token(token)

            logger.info(
                "KEYCLOAK INTROSPECTION RESULT: active=%r client_id=%r azp=%r "
                "scope=%r exp=%r iat=%r iss=%r",
                claims.get("active"),   
                claims.get("client_id"),
                claims.get("azp"),
                claims.get("scope"),
                claims.get("exp"),
                claims.get("iat"),
                claims.get("iss"),
            )

        except HTTPException as exc:
            logger.error(
                "KEYCLOAK INTROSPECTION FAILED: status=%s detail=%s",
                exc.status_code,
                exc.detail,
            )
            return None

        if not claims.get("active", False):
            logger.error("MCP TOKEN REJECTED: Keycloak says active=false")
            return None

        scopes = str(claims.get("scope", "")).split()

        logger.info(
            "MCP TOKEN SCOPES: %r | required: mcp:execute",
            scopes,
        )

        if "mcp:execute" not in scopes:
            logger.error(
                "MCP TOKEN REJECTED: mcp:execute scope missing"
            )
            return None

        return AccessToken(
            token=token,
            client_id=str(
                claims.get(
                    "client_id",
                    claims.get("azp", "unknown")
                )
            ),
            scopes=scopes,
            expires_at=int(claims["exp"]) if claims.get("exp") else None,
            subject=claims.get("sub"),
            claims=claims,
        )

_issuer = settings.OAUTH_ISSUER_URL
_alt_issuer = (
    _issuer.replace("localhost", "127.0.0.1")
    if "localhost" in _issuer
    else _issuer.replace("127.0.0.1", "localhost")
)

mcp_auth = RemoteAuthProvider(
    token_verifier=KeycloakTokenVerifier(
        base_url=f"{settings.BASE_URI}:8010",
        resource_base_url=f"{settings.BASE_URI}:8010",
        required_scopes=["mcp:execute"],
    ),
    authorization_servers=[AnyHttpUrl(_issuer), AnyHttpUrl(_alt_issuer)],
    base_url=f"{settings.BASE_URI}:8010",
    resource_base_url=f"{settings.BASE_URI}:8010",
)

# ---------------------------------------------------------------------------
# FastMCP instance
# ---------------------------------------------------------------------------
mcp = FastMCP(
    name="6G-Core-Network",
    instructions=(
        "MCP gateway for a 6G Agentic AI Core Network. "
        "Tools let you register and authenticate robots, assign validated tasks, "
        "discover robots by skill, inspect inboxes, and query active sessions. "
        "All operations are orchestrated through the Supervisor agent."
    ),
    auth=mcp_auth,
)

# ---------------------------------------------------------------------------
# Internal A2A client — authenticates as the MCP gateway agent
# ---------------------------------------------------------------------------
_client = A2AClient("mcp-server", settings.client_credentials("mcp-server")[1])

# Port topology for the static topology resource
_TOPOLOGY = {
    "services": [
        {"name": "Registry Service",     "port": 9001, "skills": ["discovery"],                           "role": "Agent Card directory and skill-based discovery"},
        {"name": "Supervisor Agent",     "port": 8000, "skills": ["orchestrate"],                         "role": "Central orchestrator for attach, service requests, and profile queries"},
        {"name": "AUSF Agent",           "port": 8001, "skills": ["auth"],                                 "role": "Agent-AKA authentication with automated low-trust recovery"},
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
    session.pop("session_id", None)
    return session


def _error(message: str, stage: str = "unknown") -> dict:
    """Return a structured error dict for MCP tool responses."""
    return {"success": False, "error": message, "stage": stage}


def _internal_tool(*args, **kwargs):
    def decorator(func):
        return func
    return decorator


_mcp_sessions: list[dict] = []


async def _record_session(agent_id: str, operation: str, details: dict, status: str = "active") -> dict:
    session = {
        "session_id": str(uuid.uuid4()),
        "agent_id": agent_id,
        "operation": operation,
        "details": details,
        "status": status,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _mcp_sessions.append(session)
    if database.db is None:
        await database.init_db()
    await database.db.mcp_sessions.insert_one(dict(session))
    return session


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
    name="register",
    description="Register or update an industrial robot Agent Card in the Registry.",
)
async def register(
    agent_id: str,
    agent_name: str,
    agent_type: str,
    imsi: str,
    imei: str,
    endpoint: str,
    skills: list[str],
    services: list[str],
    metadata: dict | None = None,
) -> dict:
    if not agent_id.strip() or not agent_name.strip() or not endpoint.strip():
        return _error("agent_id, agent_name, and endpoint are required", "validation")
    if not skills:
        return _error("at least one skill is required", "validation")

    normalized_skills = [
        {
            "id": skill.strip(),
            "name": skill.strip().replace("_", " ").title(),
            "description": f"Robot skill: {skill.strip()}",
            "endpoint": "/task",
        }
        for skill in skills
        if isinstance(skill, str) and skill.strip()
    ]
    if not normalized_skills:
        return _error("skills must contain non-empty strings", "validation")

    card = {
        "id": agent_id.strip(),
        "name": agent_name.strip(),
        "description": f"Industrial robot agent: {agent_name.strip()}",
        "url": endpoint.strip().rstrip("/"),
        "skills": normalized_skills,
        "services": [service.strip() for service in services if isinstance(service, str) and service.strip()],
        "imsi": imsi.strip(),
        "imei": imei.strip(),
        "metadata": {"agent_type": agent_type.strip(), **(metadata or {})},
    }
    response = await _safe_call(_client.register(card), "registry")
    if not response.get("success", True) and "error" in response:
        return response
    session = await _record_session(agent_id.strip(), "register", {"agent_card": card})
    return {"success": True, "agent_id": agent_id.strip(), "agent": _sanitize_card(card), "session": _sanitize_session(session)}


@mcp.tool(
    name="authenticate",
    description="Authenticate a registered robot using its assigned Agent ID and subscriber identity.",
)
async def authenticate(
    agent_id: str,
    imsi: str = "",
    imei: str = "",
    simulate_low_trust: bool = False,
) -> dict:
    if not agent_id.strip():
        return _error("agent_id is required", "validation")
    try:
        card = await _client.find_agent_by_id(agent_id.strip())
    except Exception as exc:
        return _error(str(exc), "registry")

    metadata = card.get("metadata") or {}
    auth_result = await attach_ue(
        imsi=(imsi or card.get("imsi") or metadata.get("imsi") or "").strip(),
        imei=(imei or card.get("imei") or metadata.get("imei") or "").strip(),
        simulate_low_trust=simulate_low_trust,
    )
    if not auth_result.get("success"):
        await _record_session(agent_id.strip(), "authenticate", {"result": auth_result}, "failed")
        return {"agent_id": agent_id.strip(), **auth_result}
    session = await _record_session(agent_id.strip(), "authenticate", {"result": auth_result})
    return {"success": True, "agent_id": agent_id.strip(), "authenticated": auth_result.get("authenticated", False), "result": auth_result, "session": _sanitize_session(session)}


@mcp.tool(
    name="assign_task",
    description="Select the best matching robot when needed, then queue and assign a task.",
)
async def assign_task(
    task: str,
    payload_kg: float = 0,
    payload: dict | None = None,
    agent_id: str | None = None,
    locations: dict | None = None,
    skill: str | None = None,
) -> dict:
    requested_skill = (skill or "").strip()
    if not task.strip():
        return _error("task is required", "validation")
    if payload_kg < 0:
        return _error("payload_kg cannot be negative", "validation")

    if database.db is None:
        await database.init_db()

    if agent_id and agent_id.strip():
        selected_agent_id = agent_id.strip()
        try:
            card = await _client.find_agent_by_id(selected_agent_id)
        except Exception as exc:
            return _error(str(exc), "registry")
    else:
        try:
            cards = await _client.list_agents()
        except Exception as exc:
            return _error(str(exc), "registry")
        candidates = []
        for candidate in cards:
            candidate_id = candidate.get("id") or candidate.get("agent_id")
            candidate_skills = candidate.get("skills", [])
            matching_skill = next(
                (
                    item for item in candidate_skills
                    if not requested_skill
                    or (item.get("id") if isinstance(item, dict) else item) == requested_skill
                ),
                None,
            )
            if not candidate_id or matching_skill is None:
                continue
            try:
                capacity = float((candidate.get("metadata") or {}).get("max_payload_kg", 0))
            except (TypeError, ValueError):
                continue
            if payload_kg <= capacity:
                current_tasks = await database.db.tasks.find({"agent_id": candidate_id}).to_list(length=1000)
                load = sum(item.get("status") in {"active", "queued"} for item in current_tasks)
                skill_id = matching_skill.get("id") if isinstance(matching_skill, dict) else matching_skill
                task_text = task.lower()
                suitability = 0 if requested_skill else (0 if skill_id == "pick_and_place" and any(word in task_text for word in ("move", "package", "station")) else 1)
                candidates.append((suitability, load, candidate_id, candidate, matching_skill))
        if not candidates:
            skill_text = requested_skill or "a suitable skill"
            return _error(f"No robot found with {skill_text} and capacity for {payload_kg} kg", "registry")
        _, _, selected_agent_id, card, selected_skill = min(candidates, key=lambda item: (item[0], item[1], item[2]))
        requested_skill = selected_skill.get("id") if isinstance(selected_skill, dict) else selected_skill

    advertised_skills = card.get("skills", [])
    selected_skill = next(
        (item for item in advertised_skills if (item.get("id") if isinstance(item, dict) else item) == requested_skill),
        None,
    )
    if selected_skill is None:
        return _error(f"Agent '{selected_agent_id}' does not advertise skill '{requested_skill}'", "validation")
    metadata = card.get("metadata") or {}
    try:
        capacity = float(metadata.get("max_payload_kg", 0))
    except (TypeError, ValueError):
        return _error("Agent max_payload_kg is invalid", "validation")
    if payload_kg > capacity:
        return _error(f"Payload {payload_kg} kg exceeds agent capacity of {capacity} kg", "validation")

    base_url = card.get("url", "").rstrip("/")
    endpoint = selected_skill.get("endpoint", "/task") if isinstance(selected_skill, dict) else "/task"
    request = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "assign_task",
        "params": {
            "agent_id": selected_agent_id,
            "skill": requested_skill,
            "task": task.strip(),
            "payload_kg": payload_kg,
            "payload": payload or {},
            "locations": locations or {},
            "task_id": str(uuid.uuid4()),
            "session_id": str(uuid.uuid4()),
        },
    }
    task_params = request["params"]
    await database.db.tasks.update_one(
        {"task_id": task_params["task_id"]},
        {
            "$set": {
                **task_params,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        },
        upsert=True,
    )
    try:
        result = await _client.send_raw(f"{base_url}/{endpoint.lstrip('/')}", request)
    except Exception as exc:
        await database.db.tasks.update_one(
            {"task_id": task_params["task_id"]},
            {"$set": {"status": "failed", "error": str(exc), "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        await _record_session(selected_agent_id, "assign_task", {"request": request, "error": str(exc)}, "failed")
        return _error(str(exc), "robot_agent")
    task_result = result.get("result", result)
    if isinstance(task_result, dict):
        task_update = {**task_result, "updated_at": datetime.now(timezone.utc).isoformat()}
        if result.get("error"):
            task_update.update({"status": "failed", "error": result["error"]})
        await database.db.tasks.update_one(
            {"task_id": task_params["task_id"]},
            {"$set": task_update},
        )
    session = await _record_session(selected_agent_id, "assign_task", {"request": request, "result": result})
    return {"success": True, "agent_id": selected_agent_id, "task": task.strip(), "result": result.get("result", result), "session": _sanitize_session(session)}


@mcp.tool(
    name="end_task_session",
    description="End one robot task session and activate the next queued task for that robot.",
)
async def end_task_session(session_id: str) -> dict:
    if not session_id.strip():
        return _error("session_id is required", "validation")
    if database.db is None:
        await database.init_db()
    task = await database.db.tasks.find_one({"session_id": session_id.strip()})
    if not task:
        return _error(f"Task session '{session_id}' not found", "tasks")
    if task.get("status") not in {"active", "queued", "accepted"}:
        return _error(f"Task session '{session_id}' is already {task.get('status')}", "tasks")

    ended_at = datetime.now(timezone.utc).isoformat()
    await database.db.tasks.update_one(
        {"session_id": session_id.strip()},
        {"$set": {"status": "completed", "ended_at": ended_at}},
    )
    queued = await database.db.tasks.find({"agent_id": task.get("agent_id")}).to_list(length=1000)
    queued = [item for item in queued if item.get("status") == "queued"]
    next_task = min(queued, key=lambda item: item.get("created_at", ""), default=None)
    if next_task:
        await database.db.tasks.update_one(
            {"task_id": next_task.get("task_id")},
            {"$set": {"status": "active", "activated_at": ended_at}},
        )
    audit = await _record_session(task.get("agent_id", "unknown"), "end_task_session", {
        "ended_session_id": session_id.strip(),
        "next_task_id": next_task.get("task_id") if next_task else None,
    }, "completed")
    return {
        "success": True,
        "agent_id": task.get("agent_id"),
        "ended_session_id": session_id.strip(),
        "next_task_id": next_task.get("task_id") if next_task else None,
        "session": _sanitize_session(audit),
    }


@mcp.tool(
    name="end_all_task_sessions",
    description="End all active and queued robot task sessions, optionally for one robot.",
)
async def end_all_task_sessions(agent_id: str | None = None) -> dict:
    if database.db is None:
        await database.init_db()
    tasks = await database.db.tasks.find({}).to_list(length=5000)
    candidates = [
        item for item in tasks
        if item.get("status") in {"active", "queued", "accepted"}
        and (not agent_id or item.get("agent_id") == agent_id.strip())
    ]
    ended_at = datetime.now(timezone.utc).isoformat()
    for task in candidates:
        final_status = "completed" if task.get("status") == "active" else "cancelled"
        await database.db.tasks.update_one(
            {"task_id": task.get("task_id")},
            {"$set": {"status": final_status, "ended_at": ended_at}},
        )
    audit = await _record_session(agent_id or "all-agents", "end_all_task_sessions", {
        "ended_count": len(candidates),
    }, "completed")
    return {
        "success": True,
        "ended_count": len(candidates),
        "agent_id": agent_id,
        "session": _sanitize_session(audit),
    }


@mcp.tool(
    name="find_robot_by_skill",
    description="Find a registered industrial robot that advertises the requested skill.",
)
async def find_robot_by_skill(skill: str) -> dict:
    if not skill.strip():
        return _error("skill is required", "validation")
    try:
        agents = await _client.list_agents()
        for card in agents:
            metadata = card.get("metadata") or {}
            is_robot = metadata.get("agent_type") == "industrial_arm" or card.get("agent_type") == "industrial_arm"
            has_skill = any(
                (item.get("id") if isinstance(item, dict) else item) == skill.strip()
                for item in card.get("skills", [])
            )
            if is_robot and has_skill:
                session = await _record_session(card.get("id") or card.get("name", "unknown"), "find_robot_by_skill", {"skill": skill.strip()})
                return {"success": True, "agent": _sanitize_card(dict(card)), "session": _sanitize_session(session)}
        return _error(f"No robot found for skill '{skill}'", "registry")
    except Exception as exc:
        return _error(str(exc), "registry")

@_internal_tool(
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


@_internal_tool(
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


@_internal_tool(
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
        data = await _client.send_raw(f"{base_url}/send-message", payload)
        return {"success": True, **data.get("result", data)}
    except httpx.HTTPStatusError as exc:
        return _error(f"Send failed with HTTP {exc.response.status_code}", "ue_agent")
    except Exception as exc:
        return _error(str(exc), "ue_agent")


@_internal_tool(
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
        data = await _client.send_raw(f"{base_url}/broadcast", payload)
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
        token = await _client.get_access_token()
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(f"{base_url}/inbox", headers=_client._headers(token))
            resp.raise_for_status()
            data = resp.json()
            messages = data.get("result", [])
            session = await _record_session(ue_agent_id.strip(), "get_ue_inbox", {"message_count": len(messages)})
            return {"success": True, "agent_id": ue_agent_id.strip(), "messages": messages, "count": len(messages), "session": _sanitize_session(session)}
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
        session = await _record_session(agent_id.strip(), "find_agent", {"found": True})
        return {"success": True, "agent": _sanitize_card(card), "session": _sanitize_session(session)}
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return _error(f"Agent '{agent_id}' not found", "registry")
        return _error(f"Registry returned HTTP {exc.response.status_code}", "registry")
    except Exception as exc:
        return _error(str(exc), "registry")


@_internal_tool(
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
        "Opaque session identifiers are redacted for security."
    )
)
async def list_active_sessions() -> dict:
    """Query the Supervisor for active subscriber sessions."""
    try:
        token = await _client.get_access_token()
        headers = _client._headers(token)
        async with httpx.AsyncClient(timeout=10.0) as http:
            resp = await http.get(
                f"{settings.BASE_URI}:8000/sessions",
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            sessions = data.get("result", [])
            session = await _record_session("mcp-server", "list_active_sessions", {"supervisor_count": len(sessions)})
            sanitized = [_sanitize_session(dict(s)) for s in sessions]
            stored_sessions = await database.db.mcp_sessions.find({"status": "active"}).to_list(length=100)
            sanitized.extend(_sanitize_session(dict(s)) for s in stored_sessions)
            task_sessions = await database.db.tasks.find({}).to_list(length=1000)
            sanitized.extend({
                "task_session_id": task.get("session_id"),
                "agent_id": task.get("agent_id"),
                "operation": "task",
                "task_id": task.get("task_id"),
                "status": task.get("status"),
                "started_at": task.get("created_at"),
                "updated_at": task.get("activated_at", task.get("created_at")),
            } for task in task_sessions if task.get("status") in {"active", "queued", "accepted"})
            return {"success": True, "sessions": sanitized, "count": len(sanitized)}
    except Exception as exc:
        return _error(str(exc), "supervisor")


@_internal_tool(
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


@_internal_tool(
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
    """Return active sessions with identifiers redacted."""
    try:
        token = await _client.get_access_token()
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




if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="localhost",
        port=8010,
        path="/mcp",
    )
