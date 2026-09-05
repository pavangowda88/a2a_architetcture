"""
Supervisor Agent — gets a task, finds the right agent by skill from registry, then calls it via A2A.
"""

from fastapi import FastAPI, APIRouter, Header, Request
from shared.models import AgentCard, AgentSkill
from shared.oauth import require_oauth_scope
from shared.a2a_client import A2AClient
from shared.config import settings
import database
from database import init_db

router = APIRouter()
client = A2AClient("supervisor-agent", settings.client_credentials("supervisor-agent")[1])

SUP_CARD = AgentCard(
    name="Supervisor Agent",
    description="Central Orchestrator for 6G Core Network Microservices",
    url=f"{settings.BASE_URI}:8000",
    skills=[
        AgentSkill(
            id="orchestrate",
            name="Orchestration",
            description="Routes tasks to the right agents via A2A protocol",
            endpoint="/task",
        )
    ],
)


async def authenticate(request: Request, scope: str):
    return await require_oauth_scope(request, scope)


@router.post("/task")
async def handle_task(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "agent:write")
    body = await request.json()
    method = body.get("method")
    params = body.get("params", {})

    if method == "authenticate_subscriber":
        ausf_resp = await client.send_by_skill("auth", "authenticate", params)
        auth_result = ausf_resp.get("result", {})

        if auth_result.get("authenticated"):
            await client.send_by_skill(
                "session",
                "update",
                {
                    "imsi": params.get("imsi"),
                    "service": "6G_ROBOTICS_SLICE",
                },
            )
            return {
                "jsonrpc": "2.0",
                "result": {"status": "completed", "result": auth_result},
                "id": body.get("id"),
            }

        return {"jsonrpc": "2.0", "result": {"status": "failed"}, "id": body.get("id")}

    elif method == "service_request":
        sub_resp = await client.send_by_skill(
            "qos",
            "lookup",
            {"imsi": params.get("imsi")},
        )
        qos_res = sub_resp.get("result")
        return {
            "jsonrpc": "2.0",
            "result": {
                "status": "completed",
                "service": params.get("service_type"),
                "qos_class": qos_res.get("qos_class"),
                "service_plan": qos_res.get("service_plan"),
            },
            "id": body.get("id"),
        }

    elif method == "get_ue_profile":
        ue_resp = await client.send_by_skill(
            "ue-profile",
            "get_ue_profile",
            {"agent_id": params.get("agent_id", "UE-Agent-001")},
        )
        return {
            "jsonrpc": "2.0",
            "result": ue_resp.get("result", {}),
            "id": body.get("id"),
        }

    elif method == "update_agent_card":
        card = params.get("card")
        source_agent = params.get("source_agent", "unknown")

        if not card:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32602, "message": "card is required"},
                "id": body.get("id"),
            }

        registry_result = await client.register(card)

        return {
            "jsonrpc": "2.0",
            "result": {
                "status": "updated",
                "source_agent": source_agent,
                "agent_id": card.get("name", "").lower().replace(" ", "_"),
                "registry": registry_result,
            },
            "id": body.get("id"),
        }

    return {
        "jsonrpc": "2.0",
        "error": {"code": -32601, "message": f"Method '{method}' not found"},
        "id": body.get("id"),
    }


@router.get("/sessions")
async def get_sessions(request: Request, authorization: str | None = Header(default=None), x_agent_id: str | None = Header(default=None)):
    await authenticate(request, "agent:read")
    sessions = await database.db.sessions.find({"status": "active"}).to_list(length=100)
    result = []
    for s in sessions:
        s.pop("_id", None)
        result.append(s)
    return {"jsonrpc": "2.0", "result": result, "id": "sessions_query"}


app = FastAPI(title="Supervisor Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    await client.register_with_retry(SUP_CARD.model_dump(), direct=True)


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return SUP_CARD.model_dump()

