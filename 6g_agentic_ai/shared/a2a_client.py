"""
A2A Client — login first, then find agent by skill from registry, then call it.
"""

import asyncio
import httpx
import uuid
import time
from typing import Any, Dict, Optional

from shared.config import settings


class A2AClient:
    def __init__(self, agent_id: str, agent_secret: str):
        self.agent_id = agent_id
        self.agent_secret = agent_secret
        self.auth_url = settings.AUTH_URL
        self.registry_url = settings.REGISTRY_URL
        self._token: Optional[str] = None
        self._token_expiry: float = 0

    def _headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "X-Agent-Id": self.agent_id,
            "Content-Type": "application/json",
        }

    async def authenticate(self) -> str:
        # reuse token if still valid
        if self._token and time.time() < (self._token_expiry - 60):
            return self._token

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{self.auth_url}/auth/login",
                json={
                    "agent_id": self.agent_id,
                    "agent_secret": self.agent_secret,
                },
            )
            response.raise_for_status()
            data = response.json()
            self._token = data["access_token"]
            self._token_expiry = time.time() + (settings.JWT_EXPIRY_MINUTES * 60)
            return self._token

    async def find_agent(self, skill_id: str) -> dict:
        """Look up an agent card by skill id from the registry."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.registry_url}/registry/find/{skill_id}"
            )
            response.raise_for_status()
            return response.json()

    async def send(self, target_url: str, method: str, params: Dict[str, Any] = None) -> dict:
        """Send JSON-RPC to a known URL (after auth)."""
        token = await self.authenticate()
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": str(uuid.uuid4()),
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                target_url,
                json=payload,
                headers=self._headers(token),
            )
            response.raise_for_status()
            return response.json()

    async def send_by_skill(self, skill_id: str, method: str, params: Dict[str, Any] = None) -> dict:
        """
        Auth → find agent by skill from registry → call that agent.
        This is the main path for agent-to-agent communication.
        """
        info = await self.find_agent(skill_id)
        return await self.send(info["url"], method, params)

    async def send_raw(self, target_url: str, body: Dict[str, Any]) -> dict:
        token = await self.authenticate()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                target_url,
                json=body,
                headers=self._headers(token),
            )
            response.raise_for_status()
            return response.json()

    async def verify_token(self) -> dict:
        """Verify the current JWT with the auth service."""
        token = await self.authenticate()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{self.auth_url}/auth/verify",
                json={"token": token},
            )
            response.raise_for_status()
            return response.json()

    async def register(self, card: dict) -> dict:
        """Register / update this agent's card directly in the registry."""
        return await self.send_raw(f"{self.registry_url}/registry/register", card)

    async def notify_card_change(self, card: dict) -> dict:
        """
        Tell notification agent that skills/card changed.
        Notification forwards to supervisor → auth login/verify → registry update.
        """
        token = await self.authenticate()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{settings.NOTIFICATION_URL}/notify",
                json={"card": card, "source_agent": self.agent_id},
                headers=self._headers(token),
            )
            response.raise_for_status()
            return response.json()

    async def register_with_retry(self, card: dict, tries: int = 10, direct: bool = False):
        """
        Register agent card on startup.
        direct=True  → write straight to registry (bootstrap agents only)
        direct=False → go through notification → supervisor → auth → registry
        """
        for i in range(tries):
            try:
                if direct:
                    result = await self.register(card)
                else:
                    result = await self.notify_card_change(card)
                print(f"Registered: {card.get('name')} -> {result}")
                return result
            except Exception as e:
                target = "registry" if direct else "notification/supervisor"
                print(f"Waiting for {target}... ({i + 1}/{tries}) {e}")
                await asyncio.sleep(2)
        print(f"Failed to register {card.get('name')}")
