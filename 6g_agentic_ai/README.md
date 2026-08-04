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

Open a separate PowerShell terminal for each command, from this folder.

```powershell
uvicorn auth_service:app --host 0.0.0.0 --port 9000
```

```powershell
uvicorn registry:app --host 0.0.0.0 --port 9001
```

```powershell
uvicorn notification_agent:app --host 0.0.0.0 --port 8006
```

```powershell
uvicorn supervisor:app --host 0.0.0.0 --port 8000
```

```powershell
uvicorn ausf:app --host 0.0.0.0 --port 8001
```

```powershell
uvicorn subscriber:app --host 0.0.0.0 --port 8002
```

```powershell
uvicorn udm:app --host 0.0.0.0 --port 8003
```

```powershell
uvicorn security:app --host 0.0.0.0 --port 8005
```

Start UE Agent 001:

```powershell
$env:UE_AGENT_ID='ue_agent_001'
$env:UE_AGENT_NAME='UE Agent 001'
$env:UE_PORT='8004'
$env:UE_IMSI='001010123456789'
$env:UE_IMEI='imei-123456789'
uvicorn ue:app --host 0.0.0.0 --port 8004
```

Start UE Agent 002:

```powershell
$env:UE_AGENT_ID='ue_agent_002'
$env:UE_AGENT_NAME='UE Agent 002'
$env:UE_PORT='8007'
$env:UE_IMSI='001010000000001'
$env:UE_IMEI='356938035643809'
uvicorn ue:app --host 0.0.0.0 --port 8007
```

When both UEs start, each prints a successful registry-registration message.

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
