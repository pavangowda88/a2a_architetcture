"""
UE Agent — User Equipment Agent representing 6G Digital Assistant / Mobile Robot.
Asks registry for orchestrator skill, then communicates with supervisor via A2A protocol.
"""

from fastapi import FastAPI, APIRouter, Request
from shared.models import AgentCard, AgentSkill, UEAgentProfile
from shared.a2a_client import A2AClient
from shared.config import settings

router = APIRouter()
client = A2AClient(agent_id="ue_agent", agent_secret=settings.AGENT_SECRET)

current_session = None
IMSI = "001010123456789"
IMEI = "imei-123456789"

ue_profile = UEAgentProfile()

UE_CARD = AgentCard(
    name="UE Agent",
    description="User Equipment Agent (Mobile Robot / Digital Assistant)",
    url=f"{settings.BASE_URI}:8004",
    skills=[
        AgentSkill(
            id="attach",
            name="Attach",
            description="6G Network attach & Agent-AKA authentication",
            endpoint="/attach",
        ),
        AgentSkill(
            id="service-request",
            name="Service Request",
            description="Issue service request under active session",
            endpoint="/service-request",
        ),
        AgentSkill(
            id="ue-profile-local",
            name="Local Profile",
            description="Get local UE Agent Card Profile",
            endpoint="/profile",
        ),
    ],
    profile=ue_profile.model_dump(by_alias=True),
)


@router.post("/attach")
async def attach(request: Request):
    global current_session
    try:
        body = await request.json()
    except Exception:
        body = {}

    params = body.get("params", body) if isinstance(body, dict) else {}
    sim_low = params.get("simulate_low_trust", False)
    sub_imsi = params.get("imsi", IMSI)
    sub_imei = params.get("imei", IMEI)

    resp = await client.send_by_skill(
        "orchestrate",
        "authenticate_subscriber",
        {
            "imsi": sub_imsi,
            "imei": sub_imei,
            "simulate_low_trust": sim_low,
            "agent_profile": ue_profile.model_dump(by_alias=True),
        },
    )
    res = resp.get("result", {})
    if res.get("status") == "completed":
        inner_res = res.get("result", {})
        current_session = inner_res.get("session_token")
        ue_profile.sessionProfile.agentSessionId = current_session or "AS123"
        ue_profile.trustProfile.trustScore = inner_res.get("trustScore", 91)
        ue_profile.trustProfile.riskLevel = inner_res.get("riskLevel", "LOW")

    return {
        "jsonrpc": "2.0",
        "result": res,
        "id": body.get("id", 1) if isinstance(body, dict) else 1,
    }


@router.post("/service-request")
async def request_service(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    params = body.get("params", body) if isinstance(body, dict) else {}
    svc = params.get("service_type", "video_call")
    sub_imsi = params.get("imsi", IMSI)

    if not current_session:
        # Perform auto attach if not yet attached
        await attach(request)

    resp = await client.send_by_skill(
        "orchestrate",
        "service_request",
        {
            "imsi": sub_imsi,
            "session_token": current_session,
            "service_type": svc,
        },
    )
    return {
        "jsonrpc": "2.0",
        "result": resp.get("result", resp),
        "id": body.get("id", 2) if isinstance(body, dict) else 2,
    }


@router.get("/profile")
@router.post("/profile")
async def get_profile():
    return {
        "jsonrpc": "2.0",
        "result": ue_profile.model_dump(by_alias=True),
        "id": "profile_request",
    }


app = FastAPI(title="UE Agent", version="2.1.0")


@app.on_event("startup")
async def startup_event():
    await client.register_with_retry(UE_CARD.model_dump())


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return UE_CARD.model_dump()

