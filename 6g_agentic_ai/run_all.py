"""
Launcher script for 6G Agentic AI Core Network services.

Launches the core services in proper start order and monitors them.
Run:
    python run_all.py
Press Ctrl+C to stop all services.
"""

import os
import sys
import time
import socket
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

SERVICES = [
    {
        "name": "1. Registry Service",
        "cmd": [sys.executable, "-m", "uvicorn", "registry:app", "--host", "0.0.0.0", "--port", "9001"],
        "port": 9001,
        "env": os.environ.copy(),
        "delay": 2,
    },
    {
        "name": "2. Notification Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "notification_agent:app", "--host", "0.0.0.0", "--port", "8006"],
        "port": 8006,
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "3. Supervisor Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "supervisor:app", "--host", "0.0.0.0", "--port", "8000"],
        "port": 8000,
        "env": os.environ.copy(),
        "delay": 2,
    },
    {
        "name": "4. AUSF Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "ausf:app", "--host", "0.0.0.0", "--port", "8001"],
        "port": 8001,
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "5. Subscriber Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "subscriber:app", "--host", "0.0.0.0", "--port", "8002"],
        "port": 8002,
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "6. UDM Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "udm:app", "--host", "0.0.0.0", "--port", "8003"],
        "port": 8003,
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "7. Security Agent",
        "cmd": [sys.executable, "-m", "uvicorn", "security:app", "--host", "0.0.0.0", "--port", "8005"],
        "port": 8005,
        "env": os.environ.copy(),
        "delay": 1,
    },
    {
        "name": "8. UE Agent 001",
        "cmd": [sys.executable, "-m", "uvicorn", "ue:app", "--host", "0.0.0.0", "--port", "8004"],
        "port": 8004,
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
        "name": "9. UE Agent 002",
        "cmd": [sys.executable, "-m", "uvicorn", "ue:app", "--host", "0.0.0.0", "--port", "8007"],
        "port": 8007,
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
]


def wait_for_port(proc, port: int, timeout: float = 30.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"process exited with code {proc.returncode}")
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return
        except OSError:
            time.sleep(0.25)
    raise TimeoutError(f"port {port} did not become available within {timeout:.0f} seconds")


def ensure_port_free(port: int):
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.2):
            raise RuntimeError(
                f"port {port} is already in use; stop the previous run_all.py services first"
            )
    except ConnectionRefusedError:
        return
    except OSError:
        return


def main():
    print("=" * 70)
    print("Starting 6G Agentic AI Core Network services")
    print("=" * 70)

    processes = []
    try:
        for svc in SERVICES:
            print(f"--> Starting {svc['name']}...")
            ensure_port_free(svc["port"])
            proc = subprocess.Popen(
                svc["cmd"],
                cwd=str(BASE_DIR),
                env=svc["env"],
            )
            processes.append((svc["name"], proc))
            wait_for_port(proc, svc["port"])
            time.sleep(svc["delay"])

        print("\n" + "=" * 70)
        print("All core services are running!")
        print("Registry API:         http://localhost:9001/registry/agents")
        print("Start MCP separately:  python mcp_server.py")
        print("Press Ctrl+C to stop all background processes.")
        print("=" * 70 + "\n")

        while True:
            time.sleep(1)

    except (KeyboardInterrupt, Exception) as exc:
        if not isinstance(exc, KeyboardInterrupt):
            print(f"\nStartup failed: {exc}")
        print("Stopping services started by this launcher...")
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
