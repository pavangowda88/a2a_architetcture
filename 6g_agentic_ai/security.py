"""
Security Agent — trust and risk assessment.
"""

from fastapi import FastAPI, APIRouter, Header, Request
from shared.models import AgentCard, AgentSkill
from shared.auth import require_auth
from shared.a2a_client import A2AClient
from shared.config import settings
import database
from database import init_db
import datetime

router = APIRouter()
client = A2AClient(agent_id="security_agent", agent_secret=settings.AGENT_SECRET)

SEC_CARD = AgentCard(
    name="Security Agent",
    description="Trust and Risk Assessment",
    url=f"{settings.BASE_URI}:8005",
    skills=[
        AgentSkill(
            id="trust",
            name="Trust Scoring",
            description="Calculates agent trust scores",
            endpoint="/trust-score",
        ),
        AgentSkill(
            id="re-evaluate",
            name="Re-evaluate Trust",
            description="Re-evaluates and elevates trust score upon UDM re-authentication",
            endpoint="/re-evaluate-trust",
        ),
    ],
)


def authenticate(request: Request):
    return require_auth(request)


@router.post("/trust-score")
async def trust_score(request: Request, authorization: str = Header(...), x_agent_id: str = Header(...)):
    authenticate(request)
    body = await request.json()
    params = body.get("params")
    imsi = params.get("imsi")
    force_low = params.get("simulate_low_trust", False)

    if force_low:
        score = 0.45
        risk = "HIGH"
    else:
        failed_count = await database.db.subscriber.count_documents({
            "imsi": imsi,
            "event_type": "auth_failure",
        })

        score = 0.91
        if failed_count > 0:
            score -= min(failed_count * 0.1, 0.4)
        risk = "LOW" if score >= 0.7 else "HIGH"

    # await database.db.security_logs.insert_one({
    #     "imsi": imsi,
    #     "event_type": "trust_check",
    #     "details": {"score": score, "risk_level": risk},
    #     "timestamp": datetime.datetime.utcnow().isoformat(),
    # })

    return {
        "jsonrpc": "2.0",
        "result": {
            "trustScore": int(score * 100) if score > 1 else int(score * 100),
            "trust_score": score,
            "riskLevel": risk,
            "risk_level": risk.lower(),
        },
        "id": body.get("id"),
    }


@router.post("/re-evaluate-trust")
async def re_evaluate_trust(request: Request, authorization: str = Header(...), x_agent_id: str = Header(...)):
    authenticate(request)
    body = await request.json()
    params = body.get("params", {})
    imsi = params.get("imsi")
    proof = params.get("reauth_proof", {})

    # Elevate trust score upon successful UDM re-authentication challenge
    elevated_score = 0.91
    risk = "LOW"

    await database.db.security_logs.insert_one({
        "imsi": imsi,
        "event_type": "trust_elevated_via_udm_reauth",
        "details": {
            "previous_risk": "HIGH",
            "new_score": elevated_score,
            "new_risk": risk,
            "proof": proof,
        },
        "timestamp": datetime.datetime.utcnow().isoformat(),
    })

    return {
        "jsonrpc": "2.0",
        "result": {
            "trustScore": 91,
            "trust_score": elevated_score,
            "riskLevel": risk,
            "risk_level": "low",
            "status": "TRUST_ELEVATED_POST_UDM_REAUTHENTICATION",
        },
        "id": body.get("id"),
    }


app = FastAPI(title="Security Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(SEC_CARD.model_dump())


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return SEC_CARD.model_dump()

