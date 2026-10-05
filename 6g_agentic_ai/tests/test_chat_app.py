"""Chat API error handling tests."""

from __future__ import annotations

import os
import sys

import pytest
from fastapi import HTTPException
import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")

import chat_app
import database


@pytest.mark.asyncio
async def test_chat_reports_llm_provider_failure(monkeypatch):
    async def tools():
        return []

    async def llm_failure(*_args):
        raise chat_app.LLMProviderError("External LLM returned HTTP 404")

    monkeypatch.setattr(chat_app.gateway, "tools", tools)
    monkeypatch.setattr(chat_app, "_handle_llm_chat", llm_failure)
    monkeypatch.setattr(chat_app, "LLM_ENABLED", True)

    with pytest.raises(HTTPException) as error:
        await chat_app.chat(chat_app.ChatRequest(conversation_id="test", message="hello"))

    assert error.value.status_code == 502
    assert error.value.detail == "External LLM returned HTTP 404"


@pytest.mark.asyncio
async def test_chat_keeps_mcp_failure_distinct_from_llm(monkeypatch):
    async def tools():
        raise RuntimeError("gateway offline")

    monkeypatch.setattr(chat_app.gateway, "tools", tools)

    with pytest.raises(HTTPException) as error:
        await chat_app.chat(chat_app.ChatRequest(conversation_id="test", message="hello"))

    assert error.value.status_code == 502
    assert error.value.detail == "Unable to reach the MCP gateway"


@pytest.mark.asyncio
async def test_task_list_returns_latest_persisted_status():
    previous_db = database.db
    database.db = database.InMemoryDatabase()
    await database.db.tasks.insert_one({
        "task_id": "persisted-task-1",
        "task": "Move package to inspection",
        "agent_id": "robot-1",
        "status": "active",
        "created_at": "2026-10-05T10:00:00+00:00",
    })
    try:
        transport = httpx.ASGITransport(app=chat_app.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            active_response = await client.get("/api/tasks")
            await database.db.tasks.update_one(
                {"task_id": "persisted-task-1"},
                {"$set": {"status": "completed"}},
            )
            completed_response = await client.get("/api/tasks")
    finally:
        database.db = previous_db

    assert active_response.status_code == 200
    assert active_response.json()["tasks"][0]["status"] == "active"
    assert completed_response.json()["tasks"][0]["status"] == "completed"


@pytest.mark.asyncio
async def test_task_assignment_uses_existing_mcp_tool(monkeypatch):
    async def assign(name, arguments):
        assert name == "assign_task"
        assert arguments == {"task": "Move package", "skill": "pick_and_place", "payload_kg": 2.0}
        return {"success": True, "agent_id": "robot-1"}

    monkeypatch.setattr(chat_app.gateway, "call", assign)
    transport = httpx.ASGITransport(app=chat_app.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/tasks", json={
            "task": "Move package",
            "skill": "pick_and_place",
            "payload_kg": 2,
        })

    assert response.status_code == 200
    assert response.json()["agent_id"] == "robot-1"