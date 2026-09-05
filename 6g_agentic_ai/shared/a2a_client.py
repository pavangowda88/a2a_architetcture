"""A2A client using OAuth 2.0 client credentials for protected calls."""

import asyncio
import httpx
import uuid
import time
from typing import Any, Dict, Optional

from shared.config import settings
from shared.oauth import OAuthClient


class A2AClient:
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.agent_id = client_id
        self.registry_url = settings.REGISTRY_URL
        self.oauth = OAuthClient(client_id, client_secret)

    def _headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    async def get_access_token(self) -> str:
        return await self.oauth.get_access_token()

    async def find_agent(self, skill_id: str) -> dict:
        """Look up an agent card by skill id from the registry."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self.registry_url}/registry/find/{skill_id}"
            )
            response.raise_for_status()
            return response.json()

    async def find_agent_by_id(self, agent_id: str) -> dict:
        """Resolve a specific agent card for peer-to-peer A2A messaging."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.registry_url}/registry/agents/{agent_id}")
            response.raise_for_status()
            return response.json()

    async def list_agents(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.registry_url}/registry/agents")
            response.raise_for_status()
            return response.json().get("agents", [])

    async def send(self, target_url: str, method: str, params: Dict[str, Any] = None) -> dict:
        """Send JSON-RPC to a known URL (after auth)."""
        token = await self.get_access_token()
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

    async def send_to_agent(self, agent_id: str, endpoint: str, method: str, params: Dict[str, Any] = None) -> dict:
        """Send directly to a discovered agent endpoint while retaining A2A auth."""
        card = await self.find_agent_by_id(agent_id)
        return await self.send(f"{card['url'].rstrip('/')}/{endpoint.lstrip('/')}", method, params)

    async def send_raw(self, target_url: str, body: Dict[str, Any]) -> dict:
        token = await self.get_access_token()
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                target_url,
                json=body,
                headers=self._headers(token),
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
        token = await self.get_access_token()
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
