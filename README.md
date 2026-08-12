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
cd 6g_agentic_ai
python seed.py
```

*Expected output*: `Database seeded successfully.`

---

### Step 3: Launch the Microservices & FastMCP Server

You have **two options** to launch the network:

#### Option A: One-Command Automated Launcher (Recommended)

Run the included launcher script to start all 11 microservices and the FastMCP Gateway in sequence:

```powershell
cd 6g_agentic_ai
python run_all.py
```

*Press `Ctrl + C` in the terminal to stop all background services.*

---

#### Option B: Step-by-Step Multi-Terminal Startup (11 Terminals)

To monitor each microservice individually, open **11 PowerShell terminals**, navigate each terminal to `cd 6g_agentic_ai`, and execute the following commands in this **exact startup order**:

```powershell
# Terminal 1 — Auth Service (port 9000) — Start FIRST
cd 6g_agentic_ai
uvicorn auth_service:app --host 0.0.0.0 --port 9000

# Terminal 2 — Registry Service (port 9001) — Start SECOND
cd 6g_agentic_ai
uvicorn registry:app --host 0.0.0.0 --port 9001

# Terminal 3 — Notification Agent (port 8006) — Start THIRD
cd 6g_agentic_ai
uvicorn notification_agent:app --host 0.0.0.0 --port 8006

# Terminal 4 — Supervisor Agent (port 8000) — Central Orchestrator
cd 6g_agentic_ai
uvicorn supervisor:app --host 0.0.0.0 --port 8000

# Terminal 5 — AUSF Agent (port 8001) — Agent-AKA Auth
cd 6g_agentic_ai
uvicorn ausf:app --host 0.0.0.0 --port 8001

# Terminal 6 — Subscriber Agent (port 8002) — QoS & Sessions
cd 6g_agentic_ai
uvicorn subscriber:app --host 0.0.0.0 --port 8002

# Terminal 7 — UDM Agent (port 8003) — Data & Vectors
cd 6g_agentic_ai
uvicorn udm:app --host 0.0.0.0 --port 8003

# Terminal 8 — Security Agent (port 8005) — Trust Scoring
cd 6g_agentic_ai
uvicorn security:app --host 0.0.0.0 --port 8005

# Terminal 9 — UE Agent 001 (port 8004)
cd 6g_agentic_ai
$env:UE_AGENT_ID='ue_agent_001'; $env:UE_AGENT_NAME='UE Agent 001'; $env:UE_PORT='8004'; $env:UE_IMSI='001010123456789'; $env:UE_IMEI='imei-123456789'; uvicorn ue:app --host 0.0.0.0 --port 8004

# Terminal 10 — UE Agent 002 (port 8007)
cd 6g_agentic_ai
$env:UE_AGENT_ID='ue_agent_002'; $env:UE_AGENT_NAME='UE Agent 002'; $env:UE_PORT='8007'; $env:UE_IMSI='001010000000001'; $env:UE_IMEI='356938035643809'; uvicorn ue:app --host 0.0.0.0 --port 8007

# Terminal 11 — FastMCP Gateway Server (port 8010) — Start LAST
cd 6g_agentic_ai
python mcp_server.py
```

*The FastMCP Gateway listens on **`http://localhost:8010/mcp`**.*

---

### Step 4: Verify System Operation

1. **Registry Directory Inspection**:
   Open `http://localhost:9001/registry/agents` in your browser or terminal to ensure all Agent Cards are registered.

2. **FastMCP Server Inspection**:
   ```powershell
   cd 6g_agentic_ai
   fastmcp inspect mcp_server.py
   ```

3. **FastMCP Web UI Inspector**:
   ```powershell
   cd 6g_agentic_ai
   fastmcp dev mcp_server.py
   ```

---

## 🤖 Connecting MCP Clients

### Claude Desktop

Add to `claude_desktop_config.json` — Windows: `%APPDATA%\Claude\claude_desktop_config.json`, Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "6g-core-network": {
      "url": "http://localhost:8010/mcp"
    }
  }
}
```

### Cursor / Roo Code / Cline

1. Open extension MCP settings → **Add Server**
2. Set **Name**: `6g-core-network`, **URL**: `http://localhost:8010/mcp`
3. Prompt your model and it will call the tools automatically.

---

## 🆓 Using This Project for FREE (No API Cost)

You can operate the entire 6G MCP system at **zero cost** using any of the options below. No credit card required.

---

### Option 1: Claude Desktop Free Plan *(Easiest)*

Claude Desktop has a **free plan** that includes full MCP tool support.

1. Download Claude Desktop from [claude.ai/download](https://claude.ai/download)
2. Sign up for a free Claude account at [claude.ai](https://claude.ai)
3. Add the MCP server config to `claude_desktop_config.json`:

   **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`  
   **Mac** — `~/Library/Application Support/Claude/claude_desktop_config.json`

   ```json
   {
     "mcpServers": {
       "6g-core-network": {
         "url": "http://localhost:8010/mcp"
       }
     }
   }
   ```

4. Restart Claude Desktop. You'll see a 🔌 tools icon in the chat box confirming MCP is connected.
5. Start prompting:
   - *"Attach UE with IMSI 001010123456789"*
   - *"Send a message from ue_agent_001 to ue_agent_002"*
   - *"Show all registered agents"*

> **Free tier limits**: Claude Desktop free includes a generous daily message allowance. MCP tool calls count as part of your conversation — no extra charges.

---

### Option 2: Cline + Groq (Free API, Very Fast) *(Best for VS Code)*

**Groq** provides a **free API tier** with extremely fast inference. No credit card needed to start.

**Step 1 — Get a free Groq API key:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for free → go to **API Keys** → click **Create API Key**
3. Copy your key (starts with `gsk_...`)

**Step 2 — Install Cline in VS Code:**
1. Open VS Code → Extensions (`Ctrl+Shift+X`)
2. Search for **Cline** and click Install

**Step 3 — Configure Cline:**
1. Click the Cline icon in the sidebar
2. Click the ⚙️ settings gear → **API Provider** → select **Groq**
3. Paste your Groq API key
4. Select model: **`llama-3.3-70b-versatile`** (free, very capable)

**Step 4 — Connect MCP:**
1. In Cline settings → click **MCP Servers** tab
2. Click **Add Server**:
   - **Name**: `6g-core-network`
   - **URL**: `http://localhost:8010/mcp`
   - **Type**: `Streamable HTTP`
3. Click Save

**Step 5 — Prompt Cline:**
```
Attach UE with IMSI 001010123456789 and IMEI imei-123456789
```
Cline will automatically call `attach_ue` and show the result.

> **Free tier**: Groq free tier gives ~14,400 tokens/minute on llama-3.3-70b. More than enough for all MCP operations.

---

### Option 3: Roo Code + Google Gemini (Free API) *(Best free quota)*

**Google Gemini** via Google AI Studio offers a **completely free API key** with generous rate limits.

**Step 1 — Get a free Gemini API key:**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account (free)
3. Click **Get API key** → **Create API key**
4. Copy your key (starts with `AIza...`)

**Step 2 — Install Roo Code in VS Code:**
1. Open VS Code → Extensions (`Ctrl+Shift+X`)
2. Search for **Roo Code** → Install

**Step 3 — Configure Roo Code:**
1. Open Roo Code from the sidebar
2. Click ⚙️ Settings → **API Provider** → select **Google Gemini**
3. Paste your API key
4. Select model: **`gemini-2.5-flash`** (free, very fast)

**Step 4 — Connect MCP:**
1. Roo Code settings → **MCP Servers** → **Add**
   - **Name**: `6g-core-network`
   - **URL**: `http://localhost:8010/mcp`
2. Save

**Step 5 — Prompt Roo Code:**
```
List all active sessions and then request video_call service for IMSI 001010123456789
```

> **Free tier**: Gemini 2.5 Flash gives 1,500 free requests/day and 1M tokens/min. Plenty for all 6G MCP operations.

---

### Option 4: Cline / Roo Code + Ollama (100% Local & Free Forever)

Run a local LLM with **Ollama** — no internet, no API key, no limits. Completely free forever.

**Step 1 — Install Ollama:**
Download from [ollama.com](https://ollama.com) and install.

**Step 2 — Pull a capable model:**
```powershell
# Recommended — good tool-calling ability, runs on most PCs (4GB RAM)
ollama pull llama3.2

# Larger, more capable (requires ~8GB RAM)
ollama pull qwen2.5-coder:7b

# Lightweight option (2GB RAM)
ollama pull gemma3:4b
```

**Step 3 — Configure Cline or Roo Code:**
1. Open Cline/Roo Code settings
2. **API Provider** → select **Ollama**
3. **Base URL**: `http://localhost:11434`
4. **Model**: `llama3.2` (or whichever you pulled)

**Step 4 — Connect MCP (same as above):**
```
Name: 6g-core-network
URL:  http://localhost:8010/mcp
```

**Step 5 — Test it:**
```
Attach the UE with IMSI 001010123456789
```

> **Note**: Ollama models vary in tool-calling quality. `qwen2.5-coder:7b` or `llama3.2` give the best MCP tool-calling results. If a model doesn't call tools correctly, try a larger one.

---

### Option 5: OpenRouter Free Models

**OpenRouter** provides access to **free-tier models** from multiple providers with a single API key.

**Step 1 — Get a free OpenRouter API key:**
1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up for free → go to **Keys** → create a key
3. No credit card needed for free models

**Step 2 — Configure Cline/Roo Code:**
1. **API Provider** → **OpenRouter**
2. Paste your OpenRouter key
3. Select a **free model** (marked with 💬 free badge):
   - `google/gemma-3-27b-it:free`
   - `meta-llama/llama-3.3-70b-instruct:free`
   - `mistralai/mistral-7b-instruct:free`

**Step 3 — Connect MCP:**
```
Name: 6g-core-network
URL:  http://localhost:8010/mcp
```

---

### Free Option Comparison

| Option | Cost | Speed | Quality | Setup Difficulty |
| --- | :---: | :---: | :---: | :---: |
| Claude Desktop (free plan) | 🆓 Free | ⚡ Fast | ⭐⭐⭐⭐⭐ | Easy |
| Cline + Groq (llama-3.3-70b) | 🆓 Free | ⚡ Fastest | ⭐⭐⭐⭐ | Easy |
| Roo Code + Gemini 2.5 Flash | 🆓 Free | ⚡ Fast | ⭐⭐⭐⭐⭐ | Easy |
| Cline + Ollama (local) | 🆓 Forever Free | 🐢 Slower | ⭐⭐⭐ | Medium |
| Roo Code + OpenRouter (free) | 🆓 Free | ⚡ Fast | ⭐⭐⭐⭐ | Easy |

> **Recommended for beginners**: Start with **Claude Desktop free plan** or **Cline + Groq** — both are zero-cost, require minimal setup, and have excellent MCP tool-calling.

---

### What to say to your LLM (example prompts)

Once MCP is connected, just describe what you want in plain English:

```
"Attach UE with IMSI 001010123456789 and IMEI imei-123456789"
"Request a video_call service for that IMSI"
"Send a message from ue_agent_001 to ue_agent_002 about sensor coordination"
"Broadcast a network-alert to all UEs"
"Show me ue_agent_002's inbox"
"List all registered agents in the network"
"Show me the network topology"
"Diagnose an attachment failure for IMSI 001010123456789"
"What's the QoS class for subscriber 001010123456789?"
"List all active sessions"
```

The LLM will automatically call the correct MCP tools and return structured results — **no GET/POST calls needed**.

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
cd 6g_agentic_ai
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
