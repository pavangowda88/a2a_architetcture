"""
Launcher script for 6G Agentic AI Core Network + FastMCP Server Gateway.

Launches all 11 microservices in proper start order and monitors them.
Run:
    python run_all.py
Press Ctrl+C to stop all services.
"""

import os
import sys
import time
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

SERVICES = [
    {
        "name": "1. Auth Service",
        "cmd": [sys.executable, "-m", "uvicorn", "auth_service:app", "--host", "0.0.0.0", "--port", "9000"],
        "env": os.environ.copy(),
        "delay": 2,
    },
    {
        "name": "2. Registry Service",
        "cmd": [sys.executable, "-m", "uvicorn", "registry:app", "--host", "0.0.0.0", "--port", "9001"],
        "env": os.environ.copy(),
        "delay": 2,
    },
    {
        "name": "3. Notification Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "notification_agent:app", "--host", "0.0.0.0", "--port", "8006"],
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "4. Supervisor Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "supervisor:app", "--host", "0.0.0.0", "--port", "8000"],
        "env": os.environ.copy(),
        "delay": 2,
    },
    {
        "name": "5. AUSF Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "ausf:app", "--host", "0.0.0.0", "--port", "8001"],
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "6. Subscriber Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "subscriber:app", "--host", "0.0.0.0", "--port", "8002"],
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "7. UDM Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "udm:app", "--host", "0.0.0.0", "--port", "8003"],
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "8. Security Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "security:app", "--host", "0.0.0.0", "--port", "8005"],
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "9. UE Agent 001",
        "cmd": [sys.executable, "-m", "uvicorn", "ue:app", "--host", "0.0.0.0", "--port", "8004"],
        "env": {
            **os.environ,
            "UE_AGENT_ID": "ue_agent_001",
            "UE_AGENT_NAME": "UE Agent 001",
            "UE_PORT": "8004",
            "UE_IMSI": "001010123456789",
            "UE_IMEI": "imei-123456789",
        },
        "delay": 1,
    },
    {
        "name": "10. UE Agent 002",
        "cmd": [sys.executable, "-m", "uvicorn", "ue:app", "--host", "0.0.0.0", "--port", "8007"],
        "env": {
            **os.environ,
            "UE_AGENT_ID": "ue_agent_002",
            "UE_AGENT_NAME": "UE Agent 002",
            "UE_PORT": "8007",
            "UE_IMSI": "001010000000001",
            "UE_IMEI": "356938035643809",
        },
        "delay": 1,
    },
    {
        "name": "11. FastMCP Gateway Server",
        "cmd": [sys.executable, "mcp_server.py"],
        "env": os.environ.copy(),
        "delay": 1,
    },
]


def main():
    print("=" * 70)
    print("Starting 6G Agentic AI Core Network & FastMCP Gateway Server")
    print("=" * 70)

    processes = []
    try:
        for svc in SERVICES:
            print(f"--> Starting {svc['name']}...")
            proc = subprocess.Popen(
                svc["cmd"],
                cwd=str(BASE_DIR),
                env=svc["env"],
            )
            processes.append((svc["name"], proc))
            time.sleep(svc["delay"])

        print("\n" + "=" * 70)
        print("All 11 microservices and FastMCP Gateway are running!")
        print("MCP Gateway Endpoint: http://localhost:8010/mcp")
        print("Registry API:         http://localhost:9001/registry/agents")
        print("Press Ctrl+C to stop all background processes.")
        print("=" * 70 + "\n")

        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print("\nStopping all services...")
        for name, proc in reversed(processes):
            print(f"Terminating {name}...")
            proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
        print("All services stopped.")


if __name__ == "__main__":
    main()
