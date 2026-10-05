import pytest
import httpx

import chat_app
from factory_simulation import FactorySimulation, ROBOT_ROLES


def registered_agents():
    return {
        skill: {"id": f"robot-{skill}", "name": f"Robot {skill}", "metadata": {"max_payload_kg": 10}}
        for skill in ROBOT_ROLES
    }


@pytest.mark.asyncio
async def test_factory_simulation_completes_order_using_registered_agents():
    simulation = FactorySimulation(registered_agents(), tick_seconds=0)

    await simulation.run()

    state = simulation.snapshot()
    assert state["status"] == "completed"
    assert state["packages"][0]["status"] == "COMPLETED"
    assert state["packages"][0]["progressPercent"] == 100
    station_counts = {station["id"]: station["itemCount"] for station in state["stations"]}
    assert station_counts == {"raw_material": 0, "assembly": 0, "inspection": 0, "packaging": 1}
    assert {robot["id"] for robot in state["robots"]} == {f"robot-{skill}" for skill in ROBOT_ROLES}
    assert all(stage["status"] == "COMPLETED" for stage in state["pipeline"])
    assert any(event["eventType"] == "PACKAGE_MOVED" for event in state["events"])


def test_factory_simulation_requires_each_registered_capability():
    agents = registered_agents()
    agents.pop("inspection")

    with pytest.raises(ValueError, match="inspection"):
        FactorySimulation(agents)


@pytest.mark.asyncio
async def test_stopping_a_registered_robot_fails_the_active_run():
    agents = registered_agents()
    simulation = FactorySimulation(agents, tick_seconds=0)
    robot_id = agents["pick_and_place"]["id"]
    assert simulation.stop_robot(robot_id)

    await simulation.run()

    state = simulation.snapshot()
    assert state["status"] == "failed"
    assert state["robots"][0]["status"] == "OFFLINE"
    assert any(stage["status"] == "FAILED" for stage in state["pipeline"])


@pytest.mark.asyncio
async def test_simulation_api_loads_agents_from_mcp_and_exposes_completed_run(monkeypatch):
    real_simulation = chat_app.FactorySimulation
    monkeypatch.setattr(chat_app, "FactorySimulation", lambda agents: real_simulation(agents, tick_seconds=0))

    async def registered_agents_call(_name, arguments):
        skill = arguments["skill"]
        return {"success": True, "agents": [{"id": f"live-{skill}", "name": f"Live {skill}", "metadata": {}}]}

    monkeypatch.setattr(chat_app.gateway, "call", registered_agents_call)
    transport = httpx.ASGITransport(app=chat_app.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        started = await client.post("/api/factory-simulation")
        assert started.status_code == 200
        assert started.json()["status"] == "running"
        await chat_app._factory_simulation_task

        current = await client.get("/api/factory-simulation")

    assert current.json()["status"] == "completed"
    assert {robot["agentId"] for robot in current.json()["robots"]} == {f"live-{skill}" for skill in ROBOT_ROLES}
    await chat_app.reset_factory_simulation()