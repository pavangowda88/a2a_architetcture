"""
Subscriber Agent — QoS and session management.
"""

from fastapi import FastAPI, APIRouter, Header, Request
import datetime
from shared.models import AgentCard, AgentSkill
from shared.auth import require_auth
from shared.a2a_client import A2AClient
from shared.config import settings
import database
from database import init_db

router = APIRouter()
client = A2AClient(agent_id="subscriber_agent", agent_secret=settings.AGENT_SECRET)

SUB_CARD = AgentCard(
    name="Subscriber Agent",
    description="Manages QoS and plans",
    url=f"{settings.BASE_URI}:8002",
    skills=[
        AgentSkill(
            id="qos",
            name="QoS Management",
            description="Lookup subscriber QoS / plan",
            endpoint="/lookup",
        ),
        AgentSkill(
            id="session",
            name="Session Update",
            description="Create or update UE session",
            endpoint="/update-session",
        ),
    ],
)


def authenticate(request: Request):
    return require_auth(request)


@router.post("/lookup")
async def lookup_subscriber(request: Request, authorization: str = Header(...), x_agent_id: str = Header(...)):
    authenticate(request)
    body = await request.json()
    imsi = body.get("params", {}).get("imsi", "001010123456789")

    sub = await database.db.subscribers.find_one({"imsi": imsi})
    if not sub:
        sub = await database.db.subscribers.find_one({})

    if not sub:
        return {"jsonrpc": "2.0", "error": {"code": 404, "message": "Subscriber not found"}, "id": body.get("id")}

    return {
        "jsonrpc": "2.0",
        "result": {
            "imsi": sub.get("imsi", imsi),
            "name": sub.get("name"),
            "qos_class": sub.get("qos_class", "QCI_1_URLLC"),
            "service_plan": sub.get("service_plan", "6G_ROBOTICS_SLICE"),
        },
        "id": body.get("id"),
    }


@router.post("/update-session")
async def update_session(request: Request, authorization: str = Header(...), x_agent_id: str = Header(...)):
    authenticate(request)
    body = await request.json()
    params = body.get("params", {})
    imsi = params.get("imsi", "001010123456789")

    existing = await database.db.sessions.find_one({"imsi": imsi})
    session_data = {
        "imsi": imsi,
        "session_token": params.get("session_token", ""),
        "service": params.get("service", "general"),
        "status": "active",
        "updated_at": datetime.datetime.utcnow().isoformat(),
    }

    if existing:
        await database.db.sessions.update_one({"imsi": imsi}, {"$set": session_data})
    else:
        await database.db.sessions.insert_one(session_data)

    return {"jsonrpc": "2.0", "result": {"updated": True, "status": "active", "imsi": imsi}, "id": body.get("id")}


app = FastAPI(title="Subscriber Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(SUB_CARD.model_dump())


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return SUB_CARD.model_dump()

