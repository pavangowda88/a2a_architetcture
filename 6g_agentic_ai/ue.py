"""Reusable UE agent instance with direct A2A peer communication."""

import datetime
import os
import uuid

from fastapi import APIRouter, FastAPI, Header, HTTPException, Request

import database
from database import init_db
from shared.a2a_client import A2AClient
from shared.oauth import require_oauth_scope
from shared.config import settings
from shared.models import AgentCard, AgentSkill, UEAgentProfile


# Run this module once per UE with distinct values for these environment variables.
AGENT_ID = os.getenv("UE_AGENT_ID", "ue_agent_001")
AGENT_NAME = os.getenv("UE_AGENT_NAME", "UE Agent 001")
AGENT_PORT = int(os.getenv("UE_PORT", "8004"))
UE_IMSI = os.getenv("UE_IMSI", "001010123456789")
UE_IMEI = os.getenv("UE_IMEI", "imei-123456789")
DIRECT_REGISTRATION = os.getenv("UE_DIRECT_REGISTRATION", "true").lower() == "true"

router = APIRouter()
client = A2AClient(AGENT_ID.replace("_", "-"), settings.client_credentials(AGENT_ID.replace("_", "-"))[1])
current_session: str | None = None
MAX_PAYLOAD_KG = 10.0

ue_profile = UEAgentProfile()
ue_profile.agentIdentity.agentId = AGENT_ID.replace("ue_agent_", "UE-Agent-")
ue_profile.supi = UE_IMSI
ue_profile.pei = UE_IMEI
ue_profile.agentIdentity.agentOwnerSUPI = UE_IMSI
ue_profile.agentIdentity.pei = UE_IMEI

UE_CARD = AgentCard(
    id=AGENT_ID,
    name=AGENT_NAME,
    description="User Equipment Agent (Mobile Robot / Digital Assistant)",
    url=f"{settings.BASE_URI}:{AGENT_PORT}",
    skills=[
        AgentSkill(id="attach", name="Attach", description="6G Network attach & Agent-AKA authentication", endpoint="/attach"),
        AgentSkill(id="service-request", name="Service Request", description="Issue service request under active session", endpoint="/service-request"),
        AgentSkill(id="peer-message", name="Peer Message", description="Receive a direct A2A message from another UE", endpoint="/messages"),
        AgentSkill(id="ue-profile-local", name="Local Profile", description="Get local UE profile", endpoint="/profile"),
    ],
    profile=ue_profile.model_dump(by_alias=True),
    metadata={"agent_type": "ue", "imsi": UE_IMSI},
)


def json_params(body: dict) -> dict:
    return body.get("params", body)


@router.post("/attach")
async def attach(request: Request):
    global current_session
    await require_oauth_scope(request, "agent:write")
    try:
        body = await request.json()
    except Exception:
        body = {}
    params = json_params(body)
    imsi, imei = params.get("imsi", UE_IMSI), params.get("imei", UE_IMEI)
    response = await client.send_by_skill("orchestrate", "authenticate_subscriber", {
        "imsi": imsi, "imei": imei, "agent_profile": ue_profile.model_dump(by_alias=True),
    })
    result = response.get("result", {})
    inner = result.get("result", {})
    if result.get("status") == "completed":
        current_session = str(uuid.uuid4())
        ue_profile.sessionProfile.agentSessionId = current_session or ue_profile.sessionProfile.agentSessionId
        ue_profile.trustProfile.trustScore = inner.get("trustScore", 91)
        ue_profile.trustProfile.riskLevel = inner.get("riskLevel", "LOW")
    return {"jsonrpc": "2.0", "result": result, "id": body.get("id", 1)}


@router.post("/service-request")
async def request_service(request: Request):
    global current_session
    await require_oauth_scope(request, "network:write")
    try:
        body = await request.json()
    except Exception:
        body = {}
    params = json_params(body)
    imsi, imei = params.get("imsi", UE_IMSI), params.get("imei", UE_IMEI)
    ue = await database.db.subscribers.find_one({"imsi": imsi, "imei": imei})
    if not ue:
        return {"jsonrpc": "2.0", "error": {"code": 404, "message": "UE is not registered"}, "id": body.get("id")}
    if not current_session:
        await attach(request)
    response = await client.send_by_skill("orchestrate", "service_request", {
        "imsi": imsi, "session_id": current_session, "service_type": params.get("service_type", "video_call"),
    })
    return {"jsonrpc": "2.0", "result": response.get("result", response), "id": body.get("id", 2)}


@router.post("/messages")
async def receive_message(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    """Authenticated A2A receiver endpoint for a peer UE's JSON-RPC message."""
    await require_oauth_scope(request, "agent:write")
    if database.db is None:
        await init_db()
    body = await request.json()
    params = json_params(body)
    message = {
        "message_id": str(uuid.uuid4()),
        "sender": x_agent_id,
        "recipient": AGENT_ID,
        "content": params.get("content"),
        "topic": params.get("topic", "general"),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    await database.db.agent_messages.insert_one(message)
    return {"jsonrpc": "2.0", "result": {"accepted": True, "message_id": message["message_id"]}, "id": body.get("id")}


@router.post("/task")
async def assign_task(request: Request):
    """Accept a pick-and-place task forwarded by the MCP gateway."""
    await require_oauth_scope(request, "agent:write")
    if database.db is None:
        await init_db()
    body = await request.json()
    params = json_params(body)
    payload_kg = params.get("payload_kg", 0)
    task_id = params.get("task_id") or str(uuid.uuid4())
    task_session_id = params.get("session_id") or str(uuid.uuid4())
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    if params.get("skill") != "pick_and_place":
        await database.db.tasks.update_one({"task_id": task_id}, {"$set": {
            "task_id": task_id,
            "session_id": task_session_id,
            "agent_id": params.get("agent_id", AGENT_ID),
            "skill": params.get("skill"),
            "task": params.get("task", ""),
            "payload_kg": payload_kg,
            "payload": params.get("payload", {}),
            "status": "rejected",
            "reason": "Unsupported skill",
            "created_at": created_at,
        }}, upsert=True)
        return {
            "jsonrpc": "2.0",
            "error": {"code": 400, "message": "Unsupported skill"},
            "id": body.get("id"),
        }
    try:
        payload_kg = float(payload_kg)
    except (TypeError, ValueError):
        return {
            "jsonrpc": "2.0",
            "error": {"code": 400, "message": "payload_kg must be a number"},
            "id": body.get("id"),
        }
    if payload_kg < 0 or payload_kg > MAX_PAYLOAD_KG:
        await database.db.tasks.update_one({"task_id": task_id}, {"$set": {
            "task_id": task_id,
            "session_id": task_session_id,
            "agent_id": params.get("agent_id", AGENT_ID),
            "skill": params.get("skill"),
            "task": params.get("task", ""),
            "payload_kg": payload_kg,
            "payload": params.get("payload", {}),
            "status": "rejected",
            "reason": "Payload exceeds capacity or is negative",
            "created_at": created_at,
        }}, upsert=True)
        return {
            "jsonrpc": "2.0",
            "error": {"code": 400, "message": f"payload_kg must be between 0 and {MAX_PAYLOAD_KG:g}"},
            "id": body.get("id"),
        }

    active_tasks = await database.db.tasks.find({"agent_id": params.get("agent_id", AGENT_ID)}).to_list(length=1000)
    has_active_task = any(item.get("status") == "active" for item in active_tasks)
    task = {
        "task_id": task_id,
        "session_id": task_session_id,
        "agent_id": params.get("agent_id", AGENT_ID),
        "skill": params["skill"],
        "task": params.get("task", ""),
        "payload_kg": payload_kg,
        "payload": params.get("payload", {}),
        "locations": params.get("locations", {}),
        "status": "queued" if has_active_task else "active",
        "created_at": created_at,
    }
    await database.db.tasks.update_one({"task_id": task_id}, {"$set": task}, upsert=True)
    return {
        "jsonrpc": "2.0",
        "result": {
            "accepted": True,
            "task_id": task_id,
            "session_id": task_session_id,
            "agent_id": params.get("agent_id", AGENT_ID),
            "skill": params["skill"],
            "task": params.get("task", ""),
            "payload_kg": payload_kg,
            "payload": task["payload"],
            "locations": task["locations"],
            "status": task["status"],
        },
        "id": body.get("id"),
    }


@router.post("/send-message")
async def send_message(request: Request):
    """Discover a peer UE through the registry and send it an A2A message."""
    await require_oauth_scope(request, "agent:write")
    body = await request.json()
    params = json_params(body)
    recipient = params.get("recipient")
    if not recipient:
        raise HTTPException(status_code=422, detail="recipient is required")
    if recipient == AGENT_ID:
        raise HTTPException(status_code=422, detail="A UE cannot send a peer message to itself")
    result = await client.send_to_agent(recipient, "/messages", "deliver_message", {
        "content": params.get("content"), "topic": params.get("topic", "general"),
    })
    return {"jsonrpc": "2.0", "result": {"recipient": recipient, "delivery": result.get("result", result)}, "id": body.get("id")}


@router.post("/broadcast")
async def broadcast(request: Request):
    """Send one A2A message to every registered UE except the sending UE."""
    await require_oauth_scope(request, "agent:write")
    body = await request.json()
    params = json_params(body)
    cards = await client.list_agents()
    recipients = [
        card.get("id") for card in cards
        if card.get("id") != AGENT_ID and card.get("metadata", {}).get("agent_type") == "ue"
    ]
    deliveries = []
    for recipient in recipients:
        try:
            result = await client.send_to_agent(recipient, "/messages", "deliver_message", {
                "content": params.get("content"), "topic": params.get("topic", "broadcast"),
            })
            deliveries.append({"recipient": recipient, "accepted": result.get("result", {}).get("accepted", False)})
        except Exception as exc:
            deliveries.append({"recipient": recipient, "accepted": False, "error": str(exc)})
    return {"jsonrpc": "2.0", "result": {"deliveries": deliveries}, "id": body.get("id")}


@router.get("/inbox")
async def inbox(request: Request):
    await require_oauth_scope(request, "agent:read")
    if database.db is None:
        await init_db()
    messages = await database.db.agent_messages.find({"recipient": AGENT_ID}).to_list(length=100)
    for message in messages:
        message.pop("_id", None)
    tasks = await database.db.tasks.find({"agent_id": AGENT_ID}).to_list(length=100)
    inbox_items = messages + [
        {
            **task,
            "type": "task",
            "recipient": AGENT_ID,
        }
        for task in tasks
    ]
    for item in inbox_items:
        item.pop("_id", None)
    return {"jsonrpc": "2.0", "result": inbox_items, "id": "inbox"}


@router.get("/profile")
@router.post("/profile")
async def get_profile(request: Request):
    await require_oauth_scope(request, "agent:read")
    return {"jsonrpc": "2.0", "result": ue_profile.model_dump(by_alias=True), "id": "profile_request"}


app = FastAPI(title=AGENT_NAME, version="2.2.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(UE_CARD.model_dump(), direct=DIRECT_REGISTRATION)


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return UE_CARD.model_dump()
