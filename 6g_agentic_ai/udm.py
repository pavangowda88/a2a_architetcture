"""
UDM Agent — subscriber data, UE profiles, UDR AF profiles, and auth vectors.
"""

from fastapi import FastAPI, APIRouter, Header, Request
import secrets, hashlib
from shared.models import AgentCard, AgentSkill
from shared.oauth import require_oauth_scope
from shared.a2a_client import A2AClient
from shared.config import settings
import database
from database import init_db

router = APIRouter()
client = A2AClient("udm-agent", settings.client_credentials("udm-agent")[1])

UDM_CARD = AgentCard(
    name="UDM Agent",
    description="Unified Data Management & Unified Data Repository (UDR)",
    url=f"{settings.BASE_URI}:8003",
    skills=[
        AgentSkill(
            id="sub-data",
            name="Subscriber Data",
            description="Get subscriber profile",
            endpoint="/subscriber-data",
        ),
        AgentSkill(
            id="auth-vectors",
            name="Auth Vectors",
            description="Generate Agent-AKA auth vectors",
            endpoint="/auth-vectors",
        ),
        AgentSkill(
            id="ue-profile",
            name="UE Agent Profile",
            description="Get UE Agent Profile Card",
            endpoint="/ue-profile",
        ),
        AgentSkill(
            id="af-profile",
            name="AF Agent Profile",
            description="Get UDR AF Agent Profile Card",
            endpoint="/af-profile",
        ),
        AgentSkill(
            id="reverify-sub",
            name="Re-verify Subscriber",
            description="Perform secondary A2A verification for low-trust recovery",
            endpoint="/reverify-subscriber",
        ),
    ],
)


async def authenticate(request: Request, scope: str):
    return await require_oauth_scope(request, scope)


@router.post("/subscriber-data")
async def get_subscriber_data(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "subscriber:read")
    body = await request.json()
    imsi = body.get("params", {}).get("imsi")

    sub = await database.db.subscribers.find_one({"imsi": imsi})
    if not sub:
        return {"jsonrpc": "2.0", "error": {"code": 404, "message": "Not found"}, "id": body.get("id")}

    return {
        "jsonrpc": "2.0",
        "result": {
            "imsi": sub["imsi"],
            "name": sub.get("name"),
            "subscription_type": sub["subscription_type"],
            "qos_class": sub["qos_class"],
            "status": sub["status"],
        },
        "id": body.get("id"),
    }


@router.post("/auth-vectors")
async def get_auth_vectors(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "authentication:request")
    body = await request.json()
    imsi = body.get("params", {}).get("imsi", "001010123456789")

    sub = await database.db.subscribers.find_one({"imsi": imsi})
    if not sub:
        # fallback default seed lookup
        sub = await database.db.subscribers.find_one({"imsi": "001010000000001"})

    auth_key = sub.get("auth_key", "465B5CE8B199B49FAA5F0A2EE238A6BC") if sub else "465B5CE8B199B49FAA5F0A2EE238A6BC"
    opc = sub.get("opc", "E8ED289DEBA952E4283B54E88E6183CA") if sub else "E8ED289DEBA952E4283B54E88E6183CA"

    rand = secrets.token_hex(16)
    return {
        "jsonrpc": "2.0",
        "result": {
            "imsi": imsi,
            "vectors": {
                "RAND": rand,
                "AUTN": hashlib.sha256(f"{auth_key}:{rand}:autn".encode()).hexdigest()[:32],
                "XRES": hashlib.sha256(f"{auth_key}:{rand}:xres".encode()).hexdigest()[:16],
                "KASME": hashlib.sha256(f"{auth_key}:{rand}:{opc}:kasme".encode()).hexdigest()[:32],
            },
        },
        "id": body.get("id"),
    }


@router.post("/ue-profile")
async def get_ue_profile(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "subscriber:read")
    body = await request.json()
    agent_id = body.get("params", {}).get("agent_id", "UE-Agent-001")

    record = await database.db.ue_profiles.find_one({"agent_id": agent_id})
    if not record:
        record = await database.db.ue_profiles.find_one({})

    if not record:
        return {"jsonrpc": "2.0", "error": {"code": 404, "message": "UE Agent profile not found"}, "id": body.get("id")}

    return {"jsonrpc": "2.0", "result": record["profile_data"], "id": body.get("id")}


@router.post("/af-profile")
async def get_af_profile(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "subscriber:read")
    body = await request.json()
    af_agent_id = body.get("params", {}).get("af_agent_id", "AF-Agent-1001")

    record = await database.db.af_profiles.find_one({"af_agent_id": af_agent_id})
    if not record:
        record = await database.db.af_profiles.find_one({})

    if not record:
        return {"jsonrpc": "2.0", "error": {"code": 404, "message": "AF Agent profile not found"}, "id": body.get("id")}

    return {"jsonrpc": "2.0", "result": record["profile_data"], "id": body.get("id")}


@router.post("/reverify-subscriber")
async def reverify_subscriber(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "authentication:request")
    body = await request.json()
    imsi = body.get("params", {}).get("imsi")

    sub = await database.db.subscribers.find_one({"imsi": imsi})
    rand = secrets.token_hex(16)
    return {
        "jsonrpc": "2.0",
        "result": {
            "verified": True,
            "imsi": imsi,
            "fresh_auth_vector": {
                "RAND": rand,
                "reauth_token": secrets.token_urlsafe(16),
                "timestamp": secrets.token_hex(8)
            },
            "status": "CREDENTIALS_REAUTHENTICATED_WITH_UDM"
        },
        "id": body.get("id"),
    }


app = FastAPI(title="UDM Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(UDM_CARD.model_dump())


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return UDM_CARD.model_dump()

