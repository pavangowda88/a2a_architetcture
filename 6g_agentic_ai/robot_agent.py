"""Generic task endpoint for dynamically registered robots."""

from __future__ import annotations

import datetime
import os
import uuid

from fastapi import FastAPI, Request

import database
from database import init_db


AGENT_ID = os.getenv("ROBOT_AGENT_ID", "robot_agent")
AGENT_SKILLS = {skill.strip() for skill in os.getenv("ROBOT_SKILLS", "").split(",") if skill.strip()}
MAX_PAYLOAD_KG = float(os.getenv("ROBOT_MAX_PAYLOAD_KG", "0"))

app = FastAPI(title=AGENT_ID, version="1.0.0")


def json_params(body: dict) -> dict:
    return body.get("params", body)


@app.on_event("startup")
async def startup_event():
    await init_db()


@app.get("/health")
async def health():
    return {"status": "ok", "agent_id": AGENT_ID}


@app.post("/task")
async def task(request: Request):
    if database.db is None:
        await init_db()
    body = await request.json()
    params = json_params(body)
    skill = str(params.get("skill", "")).strip()
    task_text = str(params.get("task", "")).strip()
    task_id = params.get("task_id") or str(uuid.uuid4())
    session_id = params.get("session_id") or str(uuid.uuid4())

    try:
        payload_kg = float(params.get("payload_kg", 0))
    except (TypeError, ValueError):
        return {"jsonrpc": "2.0", "error": {"code": 400, "message": "payload_kg must be a number"}, "id": body.get("id")}

    if skill not in AGENT_SKILLS:
        return {"jsonrpc": "2.0", "error": {"code": 400, "message": f"Unsupported skill: {skill}"}, "id": body.get("id")}
    if not task_text:
        return {"jsonrpc": "2.0", "error": {"code": 400, "message": "task is required"}, "id": body.get("id")}
    if payload_kg < 0 or payload_kg > MAX_PAYLOAD_KG:
        return {"jsonrpc": "2.0", "error": {"code": 400, "message": f"payload_kg must be between 0 and {MAX_PAYLOAD_KG:g}"}, "id": body.get("id")}

    active_tasks = await database.db.tasks.find({"agent_id": AGENT_ID}).to_list(length=1000)
    status = "queued" if any(item.get("status") == "active" for item in active_tasks) else "active"
    record = {
        "task_id": task_id,
        "session_id": session_id,
        "agent_id": AGENT_ID,
        "skill": skill,
        "task": task_text,
        "payload_kg": payload_kg,
        "payload": params.get("payload", {}),
        "locations": params.get("locations", {}),
        "status": status,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    await database.db.tasks.update_one({"task_id": task_id}, {"$set": record}, upsert=True)
    return {"jsonrpc": "2.0", "result": {"accepted": True, **record}, "id": body.get("id")}