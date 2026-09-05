"""
Notification Agent — receives agent card / skill changes and forwards to Supervisor.
Supervisor will login, verify, then update the registry.
"""

from fastapi import FastAPI, APIRouter, Request, HTTPException
from shared.models import AgentCard, AgentSkill
from shared.oauth import require_oauth_scope
from shared.a2a_client import A2AClient
from shared.config import settings
from database import init_db

router = APIRouter()
client = A2AClient("notification-agent", settings.client_credentials("notification-agent")[1])

NOTIF_CARD = AgentCard(
    name="Notification Agent",
    description="Notifies supervisor when an agent card or skills change",
    url=f"{settings.BASE_URI}:8006",
    skills=[
        AgentSkill(
            id="card-notify",
            name="Card Change Notification",
            description="Send updated agent card to supervisor",
            endpoint="/notify",
        )
    ],
)


@router.post("/notify")
async def notify_card_change(request: Request):
    await require_oauth_scope(request, "agent:write")
    body = await request.json()
    card = body.get("card")

    if not card:
        raise HTTPException(status_code=400, detail="card is required")

    source_agent = body.get("source_agent") or request.headers.get("X-Agent-Id", "unknown")

    resp = await client.send_by_skill(
        "orchestrate",
        "update_agent_card",
        {
            "card": card,
            "source_agent": source_agent,
        },
    )

    return {
        "status": "forwarded",
        "source_agent": source_agent,
        "supervisor_response": resp,
    }


app = FastAPI(title="Notification Agent", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()
    # bootstrap itself directly once so other agents can find notification skill
    await client.register_with_retry(NOTIF_CARD.model_dump(), direct=True)


app.include_router(router)


@app.get("/.well-known/agent.json")
async def agent_card():
    return NOTIF_CARD.model_dump()
