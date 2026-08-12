# 6G Agentic AI Core Network — FastMCP Gateway & A2A Architecture Guide

A state-of-the-art **6G Agentic AI Core Network** simulation featuring a **Model Context Protocol (MCP) Gateway Server** powered by `FastMCP`.

This project enables LLMs (via Claude Desktop, Cursor, Roo Code, Cline, Windsurf, Groq, Ollama, etc.) to autonomously attach User Equipments (UEs), request network service slices, deliver direct & broadcast A2A peer messages, query agent registries, monitor active sessions, and execute step-by-step diagnostic workflows over standardized MCP tools, resources, and prompts.

---

## 🏗️ Architecture & Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM Client                           │
│        (Claude Desktop, Cursor, Roo Code, Cline)            │
└──────────────────────────────┬──────────────────────────────┘
                               │ MCP Protocol (Streamable HTTP)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              FastMCP Gateway  :8010/mcp                     │
│                                                             │
│  Tools: attach_ue, request_ue_service, send_ue_message,     │
│         broadcast_ue_message, get_ue_inbox, find_agent,     │
│         find_agent_by_skill, list_active_sessions,          │
│         get_subscriber_profile, run_supervisor_workflow     │
│  Resources: network://agent-cards, network://active-sessions│
│             network://topology                              │
│  Prompts: diagnose_network_issue                            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Authenticated A2A JSON-RPC 2.0
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
   Supervisor               Registry              UE Agents
     :8000                    :9001             :8004, :8007
        │
   ┌────┼────┬────┐
   ▼    ▼    ▼    ▼
 AUSF  UDM  Sec  Sub
 :8001 :8003 :8005 :8002
```

### Core Microservices Topology

| Service | Port | Advertised Skills | Primary Role & Description |
| --- | :---: | --- | --- |
| **Auth Service** | `9000` | `login`, `verify` | Issues and verifies JWT access tokens for caller authentication. |
| **Registry Service** | `9001` | `discovery` | Directory storing Agent Cards (`/.well-known/agent.json`) and skill-based discovery. |
| **Notification Agent** | `8006` | `card-notify` | Forwards updated Agent Card registrations to the Supervisor. |
| **Supervisor Agent** | `8000` | `orchestrate` | Central orchestrator (manages subscriber authentication, QoS service requests, sessions). |
| **AUSF Agent** | `8001` | `auth`, `verify-session` | Performs 6G Agent-AKA authentication; triggers low-trust recovery when trust score < 0.7. |
| **Subscriber Agent** | `8002` | `qos`, `session` | Manages subscriber QoS classes, service plans, and active session records. |
| **UDM Agent** | `8003` | `sub-data`, `auth-vectors`, `ue-profile`, `reverify-sub` | Unified Data Management (auth vectors RAND/AUTN/XRES, subscriber profile data). |
| **Security Agent** | `8005` | `trust`, `re-evaluate` | Calculates real-time trust scores and assesses security risk levels. |
| **UE Agent 001** | `8004` | `attach`, `service-request`, `peer-message` | Simulated User Equipment instance 001 (`imsi: 001010123456789`). |
| **UE Agent 002** | `8007` | `attach`, `service-request`, `peer-message` | Simulated User Equipment instance 002 (`imsi: 001010000000001`). |
| **FastMCP Gateway** | `8010` | `mcp-tools` | Streamable HTTP MCP Server connecting LLM clients to the network (`:8010/mcp`). |

---

## 🚀 Step-by-Step Running Guide

Follow these step-by-step instructions to set up, launch, and operate the complete system.

### Step 1: Environment & Dependency Setup

1. **Verify Python 3.10+ installation**:
   ```powershell
   python --version
   ```

2. **Navigate to the project source directory**:
   ```powershell
   cd 6g_agentic_ai
   ```

3. **Create and activate a virtual environment** *(optional but recommended)*:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

4. **Install required dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

5. **Configure environment settings (`.env`)**:
   Keep or create `.env` in `6g_agentic_ai/.env`:
   ```env
   MONGO_URI=mongodb://localhost:27017/
   DATABASE_NAME=sixg_agentic
   JWT_SECRET=Nokia6GSecretKey2026
   AGENT_SECRET=secret123
   BASE_URI=http://localhost
   ```

---

### Step 2: Seed the Database

Seed MongoDB with initial subscriber profiles, UE credentials, and agent records:

```powershell
python seed.py
```

*Expected output*: `Database seeded successfully.`

---

### Step 3: Launch the Microservices & FastMCP Server

You have **two options** to launch the network:

#### Option A: One-Command Automated Launcher (Recommended)

Run the included launcher script to start all 11 microservices and the FastMCP Gateway in sequence:

```powershell
python run_all.py
```

*Press `Ctrl + C` in the terminal to stop all background services.*

---

#### Option B: Step-by-Step Multi-Terminal Startup (11 Terminals)

To monitor each microservice individually, open **11 PowerShell terminals**, navigate each terminal to `cd 6g_agentic_ai`, and execute the following commands in this **exact startup order**:

```powershell
# Terminal 1 — Auth Service (port 9000) — Start FIRST
uvicorn auth_service:app --host 0.0.0.0 --port 9000

# Terminal 2 — Registry Service (port 9001) — Start SECOND
uvicorn registry:app --host 0.0.0.0 --port 9001

# Terminal 3 — Notification Agent (port 8006) — Start THIRD
uvicorn notification_agent:app --host 0.0.0.0 --port 8006

# Terminal 4 — Supervisor Agent (port 8000) — Central Orchestrator
uvicorn supervisor:app --host 0.0.0.0 --port 8000

# Terminal 5 — AUSF Agent (port 8001) — Agent-AKA Auth
uvicorn ausf:app --host 0.0.0.0 --port 8001

# Terminal 6 — Subscriber Agent (port 8002) — QoS & Sessions
uvicorn subscriber:app --host 0.0.0.0 --port 8002

# Terminal 7 — UDM Agent (port 8003) — Data & Vectors
uvicorn udm:app --host 0.0.0.0 --port 8003

# Terminal 8 — Security Agent (port 8005) — Trust Scoring
uvicorn security:app --host 0.0.0.0 --port 8005

# Terminal 9 — UE Agent 001 (port 8004)
$env:UE_AGENT_ID='ue_agent_001'; $env:UE_AGENT_NAME='UE Agent 001'; $env:UE_PORT='8004'; $env:UE_IMSI='001010123456789'; $env:UE_IMEI='imei-123456789'; uvicorn ue:app --host 0.0.0.0 --port 8004

# Terminal 10 — UE Agent 002 (port 8007)
$env:UE_AGENT_ID='ue_agent_002'; $env:UE_AGENT_NAME='UE Agent 002'; $env:UE_PORT='8007'; $env:UE_IMSI='001010000000001'; $env:UE_IMEI='356938035643809'; uvicorn ue:app --host 0.0.0.0 --port 8007

# Terminal 11 — FastMCP Gateway Server (port 8010) — Start LAST
python mcp_server.py
```

*The FastMCP Gateway listens on **`http://localhost:8010/mcp`**.*

---

### Step 4: Verify System Operation

1. **Registry Directory Inspection**:
   Open `http://localhost:9001/registry/agents` in your browser or terminal to ensure all Agent Cards are registered.

2. **FastMCP Server Inspection**:
   ```powershell
   fastmcp inspect mcp_server.py
   ```

3. **FastMCP Web UI Inspector**:
   ```powershell
   fastmcp dev mcp_server.py
   ```

---

## 🤖 Connecting MCP Clients (Claude Desktop, Cursor, Roo Code)

### 1. Claude Desktop Configuration

Add the MCP server URL to your `claude_desktop_config.json`:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "6g-core-network": {
      "url": "http://localhost:8010/mcp"
    }
  }
}
```

### 2. Cursor / Roo Code / Cline Configuration

1. In VS Code or Cursor, open the extension MCP settings.
2. Add a new SSE / HTTP MCP Server:
   - **Name**: `6g-core-network`
   - **URL**: `http://localhost:8010/mcp`
3. Prompt your model (Claude 3.5/3.7, Groq `llama-3.3-70b-versatile`, OpenAI GPT-4o) to execute network operations!

---

## 🧰 MCP Tool, Resource & Prompt Reference

### 🛠️ Available MCP Tools

| Tool Name | Parameters | Description |
| --- | --- | --- |
| `attach_ue` | `imsi`, `imei`, `simulate_low_trust?` | Performs end-to-end 6G Agent-AKA network attach via Supervisor (orchestrates AUSF → UDM → Security → Subscriber). |
| `request_ue_service` | `imsi`, `imei`, `service_type` | Requests service allocation (e.g. `video_call`, `robotics_slice`) under an active session. |
| `send_ue_message` | `sender_id`, `recipient_id`, `topic`, `content` | Delivers an authenticated A2A peer message from one UE agent to another. |
| `broadcast_ue_message` | `sender_id`, `topic`, `content` | Broadcasts an A2A message from a sender UE to all other registered UE agents. |
| `get_ue_inbox` | `ue_agent_id` | Retrieves received inbox messages for a specified UE agent. |
| `find_agent` | `agent_id` | Looks up a specific Agent Card in the Registry directory. |
| `find_agent_by_skill` | `skill_id` | Discovers an agent by its advertised skill (e.g. `orchestrate`, `auth`, `qos`). |
| `list_active_sessions` | — | Lists all currently active subscriber sessions (tokens redacted for security). |
| `get_subscriber_profile` | `imsi` | Fetches subscriber QoS class and assigned service plan. |
| `run_supervisor_workflow` | `goal`, `params?` | Maps high-level goals (`attach UE`, `request service`, `diagnose`) into Supervisor workflows. |

### 📄 Available MCP Resources

| URI | Description |
| --- | --- |
| `network://agent-cards` | Live JSON snapshot of all registered Agent Cards in the network. |
| `network://active-sessions` | Live JSON snapshot of active subscriber sessions (sensitive tokens redacted). |
| `network://topology` | Interactive network topology map detailing ports, advertised skills, and roles. |

### 💬 Available MCP Diagnostic Prompts

| Prompt Name | Arguments | Description & Scope |
| --- | --- | --- |
| `diagnose_network_issue` | `issue_type`, `imsi?`, `agent_id?` | Step-by-step diagnostic workflows for `attachment`, `authentication`, `qos`, `registry`, `messaging`. |

---

## 🧪 Unit Testing

Run the automated test suite (all A2A communications are mocked — no running microservices required):

```powershell
python -m pytest tests/test_mcp_tools.py -v
```

---

## 📡 REST API & A2A Direct Endpoint Reference

For direct HTTP testing outside of MCP (e.g., Postman or Thunder Client), endpoints are exposed as follows:

- **Auth Service (`:9000`)**: `POST /auth/login`, `POST /auth/verify`
- **Registry Service (`:9001`)**: `POST /registry/register`, `GET /registry/agents`, `GET /registry/find/{skill_id}`
- **Supervisor Agent (`:8000`)**: `POST /task`, `GET /sessions`
- **AUSF Agent (`:8001`)**: `POST /authenticate`, `POST /verify-session`
- **Subscriber Agent (`:8002`)**: `POST /lookup`, `POST /update-session`
- **UDM Agent (`:8003`)**: `POST /subscriber-data`, `POST /auth-vectors`, `POST /reverify-subscriber`
- **Security Agent (`:8005`)**: `POST /trust-score`, `POST /re-evaluate-trust`
- **Notification Agent (`:8006`)**: `POST /notify`
- **UE Agents (`:8004`, `:8007`)**: `POST /send-message`, `POST /broadcast`, `GET /inbox`
