"""
Auth Service — handles agent login and JWT tokens.
"""

import base64
import hashlib
import hmac
import logging
import secrets

import bcrypt
from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel

from shared.models import AgentCard, AgentSkill, AgentProvider
from shared.auth import create_token, verify_token
from shared.config import settings
import database  
from database import init_db  

logger = logging.getLogger(__name__)

# Agent secrets are machine credentials, not human passwords.  PBKDF2 accepts
# the complete byte sequence, unlike bcrypt's 72-byte password limit.
_PBKDF2_PREFIX = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 600_000


def hash_secret(plain_secret: str) -> str:
    if not plain_secret:
        raise ValueError("Agent secret must not be empty")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", plain_secret.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "$".join((
        _PBKDF2_PREFIX,
        str(_PBKDF2_ITERATIONS),
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    ))


def verify_secret(plain_secret: str, hashed_secret: str) -> bool:
    """Verify current PBKDF2 credentials and legacy bcrypt credentials.

    Legacy bcrypt is accepted only to migrate existing short-secret rows.  It
    is never used to create a new credential, so long service credentials are
    not truncated or silently weakened.
    """
    if not plain_secret or not hashed_secret:
        return False
    try:
        parts = hashed_secret.split("$")
        if len(parts) == 4 and parts[0] == _PBKDF2_PREFIX:
            iterations = int(parts[1])
            salt = base64.urlsafe_b64decode(parts[2].encode("ascii"))
            expected = base64.urlsafe_b64decode(parts[3].encode("ascii"))
            actual = hashlib.pbkdf2_hmac(
                "sha256", plain_secret.encode("utf-8"), salt, iterations
            )
            return hmac.compare_digest(actual, expected)
        if hashed_secret.startswith(("$2a$", "$2b$", "$2y$")):
            return bcrypt.checkpw(plain_secret.encode("utf-8"), hashed_secret.encode("utf-8"))
    except (ValueError, TypeError, UnicodeError):
        return False
    return False


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
        logger.warning("Authentication failed: agent_id=%s reason=invalid_credentials", req.agent_id)
        raise HTTPException(status_code=401, detail="Authentication Failed")

    # Upgrade a successful legacy bcrypt verification in place.  The plaintext
    # credential remains only in this request and is never logged.
    if not agent_record["hashed_secret"].startswith(f"{_PBKDF2_PREFIX}$"):
        await database.db.auth_keys.update_one(
            {"agent_id": req.agent_id},
            {"$set": {"hashed_secret": hash_secret(req.agent_secret)}},
        )

    token = create_token(agent_id=req.agent_id, role=agent_record["role"])
    logger.info("Authentication succeeded: agent_id=%s", req.agent_id)
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
