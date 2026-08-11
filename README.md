# 6G Agentic AI Core Network — A2A API Guide

This project is a 6G agentic-core simulation. Network-function agents discover
each other through the registry and communicate through authenticated A2A
JSON-RPC calls. It also supports direct communication between multiple UE agents.

```
UE Agent 001  ->  Registry discovers UE Agent 002  ->  UE Agent 002
     :8004                    :9001                       :8007
```

## Services and ports

| Service | Port | Purpose |
| --- | ---: | --- |
| MongoDB | configured in `.env` | Stores credentials, registry records, and messages |
| Auth service | 9000 | Issues the JWT used for agent-to-agent delivery |
| Registry service | 9001 | Stores Agent Cards and resolves a UE by ID |
| Supervisor agent | 8000 | Orchestrates subscriber authentication and service requests |
| AUSF agent | 8001 | Performs Agent-AKA authentication |
| Subscriber agent | 8002 | Manages subscriber QoS and session records |
| UDM agent | 8003 | Supplies subscriber data, UE profiles, and authentication vectors |
| UE Agent 001 | 8004 | Sends a message |
| UE Agent 002 | 8007 | Receives a message |
| Security agent | 8005 | Calculates and re-evaluates trust |
| Notification agent | 8006 | Forwards Agent Card updates to the supervisor |

> **Port note:** `security.py` uses port 8005. The UE 002 example uses port
> 8007 to avoid this conflict.

## 1. Configure and seed

Keep your supplied `.env` file in this folder. Install dependencies once:

```powershell
pip install -r requirements.txt
```

Seed the MongoDB database. This creates credentials for `ue_agent_001`,
`ue_agent_002`, and `ue_agent_003`, along with test subscribers.

```powershell
python seed.py
```

## 2. Start the complete system

You need **11 separate PowerShell terminals**, all with the working directory set to this folder. The services must start in a specific order because they register themselves with the Registry and depend on upstream services being available.

**Terminal 1 — Auth Service (port 9000)** — Start this FIRST:
```powershell
uvicorn auth_service:app --host 0.0.0.0 --port 9000
```

**Terminal 2 — Registry Service (port 9001)** — Start SECOND:
```powershell
uvicorn registry:app --host 0.0.0.0 --port 9001
```

**Terminal 3 — Notification Agent (port 8006)** — Start THIRD:
```powershell
uvicorn notification_agent:app --host 0.0.0.0 --port 8006
```

**Terminal 4 — Supervisor Agent (port 8000)** — The central orchestrator:
```powershell
uvicorn supervisor:app --host 0.0.0.0 --port 8000
```

**Terminal 5 — AUSF Agent (port 8001)** — Handles authentication:
```powershell
uvicorn ausf:app --host 0.0.0.0 --port 8001
```

**Terminal 6 — Subscriber Agent (port 8002)** — QoS and sessions:
```powershell
uvicorn subscriber:app --host 0.0.0.0 --port 8002
```

**Terminal 7 — UDM Agent (port 8003)** — Subscriber data and auth vectors:
```powershell
uvicorn udm:app --host 0.0.0.0 --port 8003
```

**Terminal 8 — Security Agent (port 8005)** — Trust scoring:
```powershell
uvicorn security:app --host 0.0.0.0 --port 8005
```

**Terminal 9 — UE Agent 001 (port 8004):**
```powershell
$env:UE_AGENT_ID='ue_agent_001'
$env:UE_AGENT_NAME='UE Agent 001'
$env:UE_PORT='8004'
$env:UE_IMSI='001010123456789'
$env:UE_IMEI='imei-123456789'
uvicorn ue:app --host 0.0.0.0 --port 8004
```

**Terminal 10 — UE Agent 002 (port 8007):**
```powershell
$env:UE_AGENT_ID='ue_agent_002'
$env:UE_AGENT_NAME='UE Agent 002'
$env:UE_PORT='8007'
$env:UE_IMSI='001010000000001'
$env:UE_IMEI='356938035643809'
uvicorn ue:app --host 0.0.0.0 --port 8007
```

**Terminal 11 — FastMCP Gateway (port 8010)** — Start this LAST:
```powershell
python mcp_server.py
```

Wait for each terminal to print its registration confirmation message (e.g., `Registered: Supervisor Agent -> ...`). When both UEs start, each prints a successful registry-registration message.

## 3. Authentication for protected APIs

Most agent endpoints require these headers:

```text
Content-Type: application/json
Authorization: Bearer <access_token>
X-Agent-Id: <calling_agent_id>
```

In Thunder Client Free, first create this request to obtain a token:

`POST http://localhost:9000/auth/login`

```json
{
  "agent_id": "ue_agent_001",
  "agent_secret": "your-agent-secret"
}
```

Copy the `access_token` from the response into the `Authorization` header when
calling protected agent endpoints directly. The UE `/send-message` and
`/broadcast` endpoints authenticate their outbound A2A calls automatically.

## 4. Test UE-to-UE communication in Thunder Client Free

Create and send these requests manually, in this order. No Thunder Client
collection is required.

### A. Verify both UE Agent Cards are registered

`GET http://localhost:9001/registry/agents`

Expected result: the response contains `ue_agent_001` and `ue_agent_002` with
`metadata.agent_type` set to `ue`.

### B. Send a direct message from UE 001 to UE 002

`POST http://localhost:8004/send-message`

Header:

```text
Content-Type: application/json
```

Body (JSON):

```json
{
  "jsonrpc": "2.0",
  "id": "ue-001-to-002",
  "params": {
    "recipient": "ue_agent_002",
    "topic": "coordination",
    "content": {
      "task": "share sensor state",
      "priority": "high"
    }
  }
}
```

Expected result: `accepted` is `true`. UE 001 discovers UE 002 through the
registry and sends the authenticated A2A message to UE 002's `/messages` endpoint.

### C. Read UE 002's inbox

`GET http://localhost:8007/inbox`

Expected result: the response contains the message with `sender` equal to
`ue_agent_001` and `recipient` equal to `ue_agent_002`.

### D. Broadcast from UE 001 to every other UE

`POST http://localhost:8004/broadcast`

Header:

```text
Content-Type: application/json
```

Body (JSON):

```json
{
  "jsonrpc": "2.0",
  "id": "ue-broadcast-001",
  "params": {
    "topic": "network-alert",
    "content": "Switch to the low-latency slice"
  }
}
```

Run `GET http://localhost:8007/inbox` again. A second message with topic
`network-alert` confirms the broadcast was delivered.

## 5. Test the 6G authentication and service flow

### Attach a UE through Supervisor → AUSF → UDM/Security

`POST http://localhost:8004/attach`

```json
{
  "jsonrpc": "2.0",
  "id": "attach-001",
  "params": {
    "imsi": "001010123456789",
    "imei": "imei-123456789"
  }
}
```

Expected result: `status` is `completed`, including a `session_token`, trust
score, and Agent-AKA authentication result.

### Request a UE service

`POST http://localhost:8004/service-request`

```json
{
  "jsonrpc": "2.0",
  "id": "service-001",
  "params": {
    "imsi": "001010123456789",
    "imei": "imei-123456789",
    "service_type": "video_call"
  }
}
```

Expected result: `status` is `completed`, with QoS class and service plan from
the Subscriber agent.

## 6. All API endpoints

### Auth service — `http://localhost:9000`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/auth/login` | Get an agent JWT using `agent_id` and `agent_secret` |
| POST | `/auth/verify` | Verify a JWT; body: `{"token":"<token>"}` |
| GET | `/.well-known/agent.json` | Auth service Agent Card |

### Registry service — `http://localhost:9001`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/registry/register` | Register or update an Agent Card; protected |
| GET | `/registry/agents` | List all registered Agent Cards |
| GET | `/registry/agents/{agent_id}` | Get one Agent Card by ID |
| GET | `/registry/find/{skill_id}` | Find the first Agent Card advertising a skill |
| GET | `/.well-known/agent.json` | Registry Agent Card |

### Supervisor agent — `http://localhost:8000`

All endpoints are protected.

| Method | Endpoint | A2A method / description |
| --- | --- | --- |
| POST | `/task` | `authenticate_subscriber`, `service_request`, `get_ue_profile`, or `update_agent_card` |
| GET | `/sessions` | List active subscriber sessions |
| GET | `/.well-known/agent.json` | Supervisor Agent Card |

### AUSF agent — `http://localhost:8001`

All endpoints are protected.

| Method | Endpoint | A2A method / description |
| --- | --- | --- |
| POST | `/authenticate` | Authenticate subscriber; params: `imsi`, optional `simulate_low_trust` |
| POST | `/verify-session` | Verify a session token; params: `session_token` |
| GET | `/.well-known/agent.json` | AUSF Agent Card |

### Subscriber agent — `http://localhost:8002`

All endpoints are protected.

| Method | Endpoint | A2A method / description |
| --- | --- | --- |
| POST | `/lookup` | QoS and service plan lookup; params: `imsi` |
| POST | `/update-session` | Create/update a session; params: `imsi`, `session_token`, `service` |
| GET | `/.well-known/agent.json` | Subscriber Agent Card |

### UDM agent — `http://localhost:8003`

All endpoints are protected.

| Method | Endpoint | A2A method / description |
| --- | --- | --- |
| POST | `/subscriber-data` | Subscriber profile; params: `imsi` |
| POST | `/auth-vectors` | Agent-AKA vectors; params: `imsi` |
| POST | `/ue-profile` | UE profile; params: `agent_id` |
| POST | `/af-profile` | AF profile; params: `af_agent_id` |
| POST | `/reverify-subscriber` | Low-trust recovery; params: `imsi` |
| GET | `/.well-known/agent.json` | UDM Agent Card |

### Security agent — `http://localhost:8005`

All endpoints are protected.

| Method | Endpoint | A2A method / description |
| --- | --- | --- |
| POST | `/trust-score` | Trust score; params: `imsi`, optional `simulate_low_trust` |
| POST | `/re-evaluate-trust` | Re-evaluate trust; params: `imsi`, `reauth_proof` |
| GET | `/.well-known/agent.json` | Security Agent Card |

### Notification agent — `http://localhost:8006`

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/notify` | Forward an updated Agent Card to the Supervisor; protected |
| GET | `/.well-known/agent.json` | Notification Agent Card |

### UE agent — `http://localhost:8004` or `http://localhost:8007`

| UE endpoint | Method | Use |
| --- | --- | --- |
| `/.well-known/agent.json` | GET | View the UE's Agent Card |
| `/send-message` | POST | Send one direct UE-to-UE A2A message |
| `/broadcast` | POST | Send an A2A message to all other registered UEs |
| `/inbox` | GET | Read messages delivered to that UE |
| `/messages` | POST | Internal authenticated receiver endpoint; do not call manually |

---

## 7. FastMCP Gateway (MCP for LLM Clients)

The project includes a **FastMCP Streamable HTTP gateway** on port **8010** that
exposes the entire 6G core network to LLM clients through the Model Context
Protocol (MCP).

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    LLM Client                           │
│          (Claude Desktop, Cursor, custom)               │
└───────────────────────┬─────────────────────────────────┘
                        │  MCP (Streamable HTTP)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              FastMCP Gateway  :8010/mcp                 │
│                                                         │
│  Tools: attach_ue, request_ue_service, send_ue_message, │
│         broadcast, inbox, find_agent, find_by_skill,    │
│         list_sessions, get_subscriber, run_workflow     │
│  Resources: agent-cards, active-sessions, topology      │
│  Prompts: diagnose_network_issue                        │
└───────────────────────┬─────────────────────────────────┘
                        │  A2A JSON-RPC (authenticated)
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Supervisor       Registry       UE Agents
     :8000            :9001        :8004, :8007
        │
   ┌────┼────┬────┐
   ▼    ▼    ▼    ▼
 AUSF  UDM  Sec  Sub
 :8001 :8003 :8005 :8002
```

**Key design principles:**

- The MCP gateway **never duplicates** business logic — every tool delegates to
  existing A2A services.
- UE attachment and service requests go **exclusively through the Supervisor**,
  which autonomously discovers and orchestrates downstream agents via the Registry.
- Secrets (JWTs, agent secrets, MongoDB credentials) are **never exposed** in
  MCP responses.

### Install

```powershell
pip install -r requirements.txt
```

### Run the MCP server

Start all existing services first (see Section 2), then:

```powershell
python mcp_server.py
```

Or equivalently:

```powershell
fastmcp run mcp_server.py --transport streamable-http --port 8010
```

The server listens on `http://localhost:8010/mcp`.

### MCP client configuration (Claude Desktop, Cursor, Groq)

**Claude Desktop:**
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "6g-core-network": {
      "url": "http://localhost:8010/mcp"
    }
  }
}
```

**Using with Groq (Cursor, Cline, Roo Code):**
Because MCP is an open standard, you are not locked into Anthropic models. You can use Groq's high-speed models to operate the network:
1. Install an AI extension in VS Code like **Roo Code** or **Cline**.
2. Set the API Provider to **Groq** and enter your API key. Select a fast model like `llama-3.3-70b-versatile`.
3. In the extension's MCP settings, add the server URL exactly like above: `http://localhost:8010/mcp`.
4. You can now prompt the Groq model to "Attach the UE" or "List active sessions" and it will call the tools automatically.

### Available MCP tools

| Tool | Parameters | Description |
| --- | --- | --- |
| `attach_ue` | `imsi`, `imei`, `simulate_low_trust?` | 6G network attach via Supervisor → AUSF → UDM → Security |
| `request_ue_service` | `imsi`, `imei`, `service_type` | Request a service under an active session |
| `send_ue_message` | `sender_id`, `recipient_id`, `topic`, `content` | Direct UE-to-UE A2A message |
| `broadcast_ue_message` | `sender_id`, `topic`, `content` | Broadcast message to all UE peers |
| `get_ue_inbox` | `ue_agent_id` | Retrieve a UE's received messages |
| `find_agent` | `agent_id` | Look up a specific Agent Card |
| `find_agent_by_skill` | `skill_id` | Discover an agent by advertised skill |
| `list_active_sessions` | — | List active UE sessions (tokens redacted) |
| `get_subscriber_profile` | `imsi` | Get subscriber QoS class and service plan |
| `run_supervisor_workflow` | `goal`, `params?` | Submit a high-level goal (attach, service request, diagnose) |

### Available MCP resources

| URI | Description |
| --- | --- |
| `network://agent-cards` | All registered Agent Cards |
| `network://active-sessions` | Active sessions (tokens redacted) |
| `network://topology` | Network service topology with ports and skills |

### Available MCP prompts

| Prompt | Parameters | Description |
| --- | --- | --- |
| `diagnose_network_issue` | `issue_type`, `imsi?`, `agent_id?` | Step-by-step diagnostic guide for: `attachment`, `authentication`, `qos`, `registry`, `messaging` |

### Example tool calls

**Attach a UE:**

```json
{
  "tool": "attach_ue",
  "arguments": {
    "imsi": "001010123456789",
    "imei": "imei-123456789"
  }
}
```

**Request a service:**

```json
{
  "tool": "request_ue_service",
  "arguments": {
    "imsi": "001010123456789",
    "imei": "imei-123456789",
    "service_type": "video_call"
  }
}
```

**Run supervisor workflow:**

```json
{
  "tool": "run_supervisor_workflow",
  "arguments": {
    "goal": "attach UE",
    "params": {
      "imsi": "001010123456789",
      "imei": "imei-123456789"
    }
  }
}
```

**Send a peer message:**

```json
{
  "tool": "send_ue_message",
  "arguments": {
    "sender_id": "ue_agent_001",
    "recipient_id": "ue_agent_002",
    "topic": "coordination",
    "content": {"task": "share sensor state"}
  }
}
```

### Testing

**Inspect the MCP server** (lists all tools, resources, and prompts):

```powershell
fastmcp inspect mcp_server.py
```

**Interactive MCP Inspector** (web UI):

```powershell
fastmcp dev mcp_server.py
```

**Run unit tests** (no running services needed — all A2A calls are mocked):

```powershell
cd 6g_agentic_ai
pytest tests/test_mcp_tools.py -v
```
