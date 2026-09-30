"""Chat API error handling tests."""

from __future__ import annotations

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/test")

import chat_app


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