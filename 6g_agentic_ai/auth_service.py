"""
Auth Service — handles agent login and JWT tokens.
"""

from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext

from shared.models import AgentCard, AgentSkill, AgentProvider
from shared.auth import create_token, verify_token
from shared.config import settings
import database
from database import init_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_secret(plain_secret: str) -> str:
    return pwd_context.hash(plain_secret)


def verify_secret(plain_secret: str, hashed_secret: str) -> bool:
    return pwd_context.verify(plain_secret, hashed_secret)


router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    agent_id: str
    agent_secret: str


class VerifyRequest(BaseModel):
    token: str


@router.post("/login")
async def login(req: LoginRequest):
    agent_record = await database.db.auth_keys.find_one({"agent_id": req.agent_id})

    if agent_record is None or not verify_secret(req.agent_secret, agent_record["hashed_secret"]):
        raise HTTPException(status_code=401, detail="Authentication Failed")

    token = create_token(agent_id=req.agent_id, role=agent_record["role"])
    return {"access_token": token, "token_type": "Bearer"}


@router.post("/verify")
async def verify(req: VerifyRequest):
    payload = verify_token(req.token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid Token")
    return payload


app = FastAPI(title="Auth Service", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    await init_db()


app.include_router(router)

AUTH_AGENT_CARD = AgentCard(
    name="Auth Service",
    description="Central authentication service",
    url=f"{settings.BASE_URI}:9000",
    skills=[AgentSkill(id="agent-login", name="Agent Login", description="JWT login")],
    provider=AgentProvider(organization="Nokia 6G Agentic AI")
)


@app.get("/.well-known/agent.json")
async def agent_card():
    return AUTH_AGENT_CARD.model_dump()
