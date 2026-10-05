from __future__ import annotations

import asyncio
import copy
import math
import time
import uuid
from datetime import datetime, timezone
from typing import Any


STATIONS = {
    "raw_material": {"name": "Raw Material Storage", "code": "STN-01", "x": 18, "y": 42},
    "assembly": {"name": "Robotic Assembly Area", "code": "STN-02", "x": 48, "y": 42},
    "inspection": {"name": "6G Laser Inspection", "code": "STN-03", "x": 78, "y": 42},
    "packaging": {"name": "Automated Packaging", "code": "STN-04", "x": 78, "y": 78},
}

ROBOT_ROLES = {
    "pick_and_place": {"station": "raw_material", "x": 18, "y": 42, "speed": 1.5},
    "welding": {"station": "assembly", "x": 48, "y": 42, "speed": 1.2},
    "inspection": {"station": "inspection", "x": 78, "y": 42, "speed": 1.4},
    "packaging": {"station": "packaging", "x": 78, "y": 78, "speed": 1.1},
}

PIPELINE = [
    ("order", "Production order"),
    ("registry", "Capability lookup"),
    ("material_transfer", "Material transfer"),
    ("assembly", "Assembly"),
    ("inspection_transfer", "Transfer to inspection"),
    ("inspection", "Quality inspection"),
    ("packaging_transfer", "Transfer to packaging"),
    ("packaging", "Packaging"),
    ("complete", "Order complete"),
]


class SimulationStopped(Exception):
    pass


class FactorySimulation:
    """Server-authoritative virtual factory run backed by registered robot agents."""

    def __init__(self, agents_by_skill: dict[str, dict[str, Any]], tick_seconds: float = 0.08):
        missing = set(ROBOT_ROLES) - agents_by_skill.keys()
        if missing:
            raise ValueError(f"Missing registered agents for skills: {', '.join(sorted(missing))}")

        self.tick_seconds = tick_seconds
        self._stopped_robots: set[str] = set()
        self._robot_ids_by_skill: dict[str, str] = {}
        robots = []
        for skill, role in ROBOT_ROLES.items():
            card = agents_by_skill[skill]
            agent_id = str(card.get("id") or card.get("agent_id") or "")
            if not agent_id:
                raise ValueError(f"Registered agent for {skill} has no ID")
            self._robot_ids_by_skill[skill] = agent_id
            metadata = card.get("metadata") or {}
            robots.append({
                "id": agent_id,
                "name": str(card.get("name") or agent_id),
                "agentId": agent_id,
                "status": "IDLE",
                "location": role["station"],
                "x": role["x"],
                "y": role["y"],
                "battery": 100.0,
                "speed": role["speed"],
                "skill": skill,
                "maxPayloadKg": metadata.get("max_payload_kg", 0),
                "oauthStatus": "UNAUTHENTICATED",
                "mcpAccess": False,
                "imsi": "",
                "imei": "",
                "lastAction": "Ready in virtual simulation",
                "lastActionTime": "--:--:--",
            })

        self.state: dict[str, Any] = {
            "runId": str(uuid.uuid4()),
            "status": "running",
            "simulationType": "virtual",
            "orderId": "104",
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "activeConveyor": False,
            "laserScanning": False,
            "stations": [
                {"id": station_id, "name": station["name"], "code": station["code"], "icon": "", "status": "IDLE", "capacity": 1, "itemCount": int(station_id == "raw_material")}
                for station_id, station in STATIONS.items()
            ],
            "robots": robots,
            "packages": [{
                "id": "P104",
                "orderId": "104",
                "name": "Workpiece P104",
                "currentStation": "raw_material",
                "progressPercent": 0,
                "status": "QUEUED",
                "originStation": "raw_material",
                "targetStation": "packaging",
            }],
            "pipeline": [
                {"id": stage_id, "label": label, "status": "PENDING", "detail": "Waiting for simulation"}
                for stage_id, label in PIPELINE
            ],
            "events": [],
        }

    def snapshot(self) -> dict[str, Any]:
        return copy.deepcopy(self.state)

    def stop_robot(self, agent_id: str) -> bool:
        robot = next((item for item in self.state["robots"] if item["id"] == agent_id), None)
        if robot is None or self.state["status"] != "running":
            return False
        self._stopped_robots.add(agent_id)
        robot["status"] = "OFFLINE"
        robot["currentTask"] = "Stopped by operator in virtual simulation"
        self._event("SECURITY_EVENT", robot["name"], "Virtual robot stopped by operator", status="failed")
        return True

    async def run(self) -> None:
        try:
            self._stage("order", "COMPLETED", "Production order #104 accepted by the simulator")
            self._stage("registry", "PROCESSING", "Validating robot capabilities from the live agent registry")
            await self._wait(5)
            self._stage("registry", "COMPLETED", f"Validated {len(self.state['robots'])} registered robot agents")
            self._event("AGENT_MESSAGE", "Registry", "Required robot capabilities verified against registered agents")

            self._stage("material_transfer", "PROCESSING", "Virtual pick-and-place cycle")
            await self._move("pick_and_place", "assembly", 20)
            self._stage("material_transfer", "COMPLETED", "P104 arrived at assembly")

            self._stage("assembly", "PROCESSING", "Virtual welding station cycle")
            await self._work("welding", "assembly", "ASSEMBLING", 55, "Assembly completed")
            self._stage("assembly", "COMPLETED", "Assembly station completed its cycle")

            self._stage("inspection_transfer", "PROCESSING", "Virtual transfer to quality inspection")
            await self._move("pick_and_place", "inspection", 70)
            self._stage("inspection_transfer", "COMPLETED", "P104 arrived at inspection")

            self._stage("inspection", "PROCESSING", "Virtual quality inspection cycle")
            self.state["laserScanning"] = True
            await self._work("inspection", "inspection", "INSPECTING", 85, "Quality inspection passed")
            self.state["laserScanning"] = False
            self._stage("inspection", "COMPLETED", "Virtual quality inspection passed")

            self._stage("packaging_transfer", "PROCESSING", "Virtual transfer to outbound packaging")
            await self._move("pick_and_place", "packaging", 92)
            self._stage("packaging_transfer", "COMPLETED", "P104 arrived at packaging")

            self._stage("packaging", "PROCESSING", "Virtual packaging station cycle")
            await self._work("packaging", "packaging", "PACKAGING", 100, "Packaging completed")
            self._stage("packaging", "COMPLETED", "Package sealed for outbound dispatch")

            self._stage("complete", "COMPLETED", "Order #104 completed in the virtual factory")
            self.state["status"] = "completed"
            self.state["finishedAt"] = datetime.now(timezone.utc).isoformat()
            self._event("TASK_COMPLETED", "Virtual simulator", "Order #104 completed; no physical robot movement was commanded")
        except SimulationStopped as exc:
            self.state["status"] = "failed"
            self.state["finishedAt"] = datetime.now(timezone.utc).isoformat()
            self._fail_active_stage(str(exc))
            self._event("TASK_FAILED", "Virtual simulator", str(exc), status="failed")
        except asyncio.CancelledError:
            self.state["status"] = "cancelled"
            self.state["finishedAt"] = datetime.now(timezone.utc).isoformat()
            raise
        except Exception as exc:
            self.state["status"] = "failed"
            self.state["finishedAt"] = datetime.now(timezone.utc).isoformat()
            self._fail_active_stage("Simulation failed")
            self._event("TASK_FAILED", "Virtual simulator", f"Simulation failed ({type(exc).__name__})", status="failed")

    async def _wait(self, ticks: int) -> None:
        for _ in range(ticks):
            await asyncio.sleep(self.tick_seconds)

    async def _move(self, skill: str, destination: str, progress: int) -> None:
        agent_id = self._robot_ids_by_skill[skill]
        robot = self._robot(agent_id)
        self._assert_running(agent_id)
        start_x, start_y = robot["x"], robot["y"]
        source_station = self._package()["currentStation"]
        end = STATIONS[destination]
        distance = math.hypot(end["x"] - start_x, end["y"] - start_y)
        self.state["activeConveyor"] = True
        robot.update({"status": "MOVING", "targetLocation": destination, "carryingPackageId": "P104", "currentTask": f"Moving P104 to {end['name']}"})
        self._package().update({"currentStation": "in_transit", "status": "ASSEMBLING" if progress <= 55 else "INSPECTING" if progress <= 85 else "PACKAGING", "attachedToRobotId": agent_id})
        self._event("ROBOT_MOVE", robot["name"], f"Virtual transfer of P104 to {end['name']} started", end["name"], status="processing")
        ticks = max(8, round(distance / 3))
        for step in range(1, ticks + 1):
            await asyncio.sleep(self.tick_seconds)
            self._assert_running(agent_id)
            ratio = step / ticks
            robot["x"] = start_x + (end["x"] - start_x) * ratio
            robot["y"] = start_y + (end["y"] - start_y) * ratio
        self._decrement_station(source_station)
        robot.update({"status": "IDLE", "location": destination, "targetLocation": None, "carryingPackageId": None, "currentTask": "Ready"})
        robot["battery"] = max(0, robot["battery"] - distance * 0.04)
        self._package().update({"currentStation": destination, "progressPercent": progress, "attachedToRobotId": None})
        self._increment_station(destination)
        self.state["activeConveyor"] = False
        self._event("PACKAGE_MOVED", robot["name"], f"P104 arrived at {end['name']} in the virtual simulation", end["name"])

    async def _work(self, skill: str, station_id: str, package_status: str, progress: int, completed_action: str) -> None:
        agent_id = self._robot_ids_by_skill[skill]
        robot = self._robot(agent_id)
        self._assert_running(agent_id)
        station = self._station(station_id)
        robot.update({"status": "BUSY", "location": station_id, "currentTask": f"Processing P104 at {station['name']}"})
        station.update({"status": "PROCESSING", "currentPackageId": "P104"})
        self._package().update({"status": package_status, "progressPercent": progress})
        self._event("TASK_STARTED", robot["name"], f"Virtual {skill} cycle started at {station['name']}", status="processing")
        await self._wait(12)
        self._assert_running(agent_id)
        robot.update({"status": "IDLE", "currentTask": "Ready"})
        robot["battery"] = max(0, robot["battery"] - 0.5)
        station.update({"status": "COMPLETED", "currentPackageId": None})
        if package_status == "PACKAGING":
            self._package().update({"status": "COMPLETED", "progressPercent": 100})
        self._event("TASK_COMPLETED", robot["name"], f"{completed_action} at {station['name']} in the virtual simulation")

    def _assert_running(self, agent_id: str) -> None:
        if agent_id in self._stopped_robots:
            raise SimulationStopped(f"Simulation stopped because {agent_id} was stopped")

    def _stage(self, stage_id: str, status: str, detail: str) -> None:
        for stage in self.state["pipeline"]:
            if stage["id"] == stage_id:
                stage.update({"status": status, "detail": detail})
                return

    def _fail_active_stage(self, detail: str) -> None:
        for stage in self.state["pipeline"]:
            if stage["status"] == "PROCESSING":
                stage.update({"status": "FAILED", "detail": detail})
                return

    def _event(self, event_type: str, source: str, action: str, target: str | None = None, status: str = "success") -> None:
        self.state["events"].insert(0, {
            "id": str(uuid.uuid4()),
            "timestamp": time.strftime("%H:%M:%S"),
            "eventType": event_type,
            "source": source,
            "target": target,
            "action": action,
            "status": status,
        })
        del self.state["events"][100:]

    def _robot(self, agent_id: str) -> dict[str, Any]:
        return next(item for item in self.state["robots"] if item["id"] == agent_id)

    def _station(self, station_id: str) -> dict[str, Any]:
        return next(item for item in self.state["stations"] if item["id"] == station_id)

    def _package(self) -> dict[str, Any]:
        return self.state["packages"][0]

    def _decrement_station(self, station_id: str) -> None:
        if station_id in STATIONS:
            station = self._station(station_id)
            station["itemCount"] = max(0, station["itemCount"] - 1)

    def _increment_station(self, station_id: str) -> None:
        self._station(station_id)["itemCount"] += 1