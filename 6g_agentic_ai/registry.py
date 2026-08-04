"""
Registry Service — agents register cards here; others find them by skill.
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request
from shared.models import AgentCard, AgentSkill
from shared.auth import require_auth
from shared.config import settings
import database
from database import init_db

router = APIRouter(prefix="/registry", tags=["Agent Registry"])


@router.post("/register")
async def register_agent(request: Request):
    require_auth(request)
    body = await request.json()
    # Prefer the explicit id so several instances of the same agent type can
    # register independently (for example ue_agent_001, ue_agent_002).
    agent_id = body.get("id") or body.get("name", "").lower().replace(" ", "_")

    existing = await database.db.agent_registry.find_one({"agent_id": agent_id})
    if existing:
        await database.db.agent_registry.update_one(
            {"agent_id": agent_id},
            {"$set": {"card": body}}
        )
    else:
        await database.db.agent_registry.insert_one({"agent_id": agent_id, "card": body})

    return {"status": "registered", "agent_id": agent_id}


@router.get("/agents")
async def list_agents():
    agents = await database.db.agent_registry.find().to_list(length=100)
    cards = [a["card"] for a in agents]
    return {"agents": cards, "count": len(cards)}


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    record = await database.db.agent_registry.find_one({"agent_id": agent_id})
    if not record:
        raise HTTPException(status_code=404, detail="Agent not found")
    return record["card"]


@router.get("/find/{skill_id}")
async def find_by_skill(skill_id: str):
    """Find an agent that has this skill. Returns card + full call URL."""
    agents = await database.db.agent_registry.find().to_list(length=100)

    for a in agents:
        card = a.get("card") or {}
        for skill in card.get("skills", []):
            if skill.get("id") == skill_id:
                base = card.get("url", "").rstrip("/")
                endpoint = skill.get("endpoint", "/")
                if not endpoint.startswith("/"):
                    endpoint = "/" + endpoint
                return {
                    "agent_id": a["agent_id"],
                    "name": card.get("name"),
                    "skill": skill,
                    "url": base + endpoint,
                    "card": card,
                }

    raise HTTPException(status_code=404, detail=f"No agent found for skill '{skill_id}'")


app = FastAPI(title="Registry Service", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()


app.include_router(router)

REGISTRY_CARD = AgentCard(
    name="Registry Service",
    description="Agent discovery and registration",
    url=f"{settings.BASE_URI}:9001",
    skills=[
        AgentSkill(
            id="discovery",
            name="Discovery",
            description="Find agents by skill",
            endpoint="/registry/find",
        )
    ],
)


@app.get("/.well-known/agent.json")
async def agent_card():
    return REGISTRY_CARD.model_dump()
