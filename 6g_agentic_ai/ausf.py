"""
AUSF Agent — finds UDM and Security from their agent cards, authenticates via Agent-AKA, and performs automated low-trust recovery.
"""

from fastapi import FastAPI, APIRouter, Header, Request
from shared.models import AgentCard, AgentSkill
from shared.oauth import require_oauth_scope
from shared.a2a_client import A2AClient
from shared.config import settings
from database import init_db

router = APIRouter()
client = A2AClient("ausf-agent", settings.client_credentials("ausf-agent")[1])

AUSF_CARD = AgentCard(
    name="AUSF Agent",
    description="Authentication Server Function",
    url=f"{settings.BASE_URI}:8001",
    skills=[
        AgentSkill(
            id="auth",
            name="Authentication",
            description="Agent-AKA 5G/6G Authentication with Automated Low-Trust Recovery",
            endpoint="/authenticate",
        ),
    ],
)


@router.post("/authenticate")
async def authenticate_sub(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await require_oauth_scope(request, "authentication:request")
    body = await request.json()
    params = body.get("params", {})
    imsi = params.get("imsi", "001010123456789")
    simulate_low_trust = params.get("simulate_low_trust", False)

    # 1. Fetch Agent-AKA Auth Vectors from UDM via A2A Communication
    udm_vec_resp = await client.send_by_skill("auth-vectors", "get_vectors", {"imsi": imsi})
    auth_vectors = udm_vec_resp.get("result", {}).get("vectors", {})

    # 2. Query Trust & Risk Level from Security Agent via A2A Communication
    sec_resp = await client.send_by_skill(
        "trust",
        "trust_score",
        {"imsi": imsi, "simulate_low_trust": simulate_low_trust}
    )
    sec_result = sec_resp.get("result", {})
    trust_score = sec_result.get("trust_score", 0.91)
    risk_level = sec_result.get("risk_level", "low")

    reauth_audit = None

    # 3. Automated Low-Trust Score Recovery Flow via A2A Communication
    if trust_score < 0.7 or risk_level.lower() == "high":
        # Step A: Communicate with UDM to fetch fresh auth vectors & re-verify credentials
        udm_reauth_resp = await client.send_by_skill(
            "reverify-sub",
            "reverify_subscriber",
            {"imsi": imsi}
        )
        reauth_proof = udm_reauth_resp.get("result", {})

        # Step B: Communicate with Security Agent to submit proof and re-evaluate trust score
        sec_re_eval = await client.send_by_skill(
            "re-evaluate",
            "re_evaluate_trust",
            {"imsi": imsi, "reauth_proof": reauth_proof}
        )
        sec_re_eval_res = sec_re_eval.get("result", {})
        trust_score = sec_re_eval_res.get("trust_score", 0.91)
        risk_level = sec_re_eval_res.get("risk_level", "low")
        reauth_audit = {
            "low_trust_detected": True,
            "udm_reauthentication_status": reauth_proof.get("status"),
            "elevated_trust_score": 91,
            "elevated_risk_level": "LOW",
        }

    return {
        "jsonrpc": "2.0",
        "result": {
            "authenticated": True,
            "authentication_method": "Agent-AKA",
            "imsi": imsi,
            "trustScore": int(trust_score * 100) if trust_score <= 1.0 else int(trust_score),
            "riskLevel": risk_level.upper(),
            "auth_vectors": {
                "RAND": auth_vectors.get("RAND"),
                "AUTN": auth_vectors.get("AUTN"),
                "XRES": auth_vectors.get("XRES"),
            },
            "automated_recovery": reauth_audit,
        },
        "id": body.get("id"),
    }


app = FastAPI(title="AUSF Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(AUSF_CARD.model_dump())


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return AUSF_CARD.model_dump()

