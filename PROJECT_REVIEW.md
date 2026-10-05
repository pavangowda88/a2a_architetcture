# Project review and implementation notes

Review scope: README, Python service entry points and browser chat API, plus React/Vite UI and its API client. Findings are based on repository code, not a running deployment.

## Findings

| Priority | Finding and evidence | User impact | Recommended fix / state |
| --- | --- | --- | --- |
| P1 | The UI previously ran a local production animation after any command containing “start” or “104”, even if the backend request failed or returned a confirmation prompt (`6g_agentic_ai/frontend/src/App.tsx`). | The visual result could imply a real robot action that never happened. | Implemented: only the explicit Start demo control runs the local scenario; failed commands now show failure and do not advance the simulated factory. |
| P1 | The frontend API client returned `connected: true` when `/api/status` was unreachable (`frontend/src/services/api.ts`); several screens also hard-coded active/connected labels and seeded identities. | Operators could confuse placeholder values with live network/security state. | Implemented: remove the fabricated success fallback, poll backend/MCP status, label the seed views as demo/sample data, and make the MCP preview say it sends no gateway request. |
| P1 | The browser event socket was an echo endpoint that required a client message, while the dashboard only listened (`chat_app.py`, `frontend/src/services/api.ts`). | The “real-time” feed could never show backend events. | Implemented: `/ws` now broadcasts actual tool-result steps from `/api/chat`; frontend reconnects safely and releases its listener/timer on teardown. |
| P1 | The robot modal labeled a local state mutation as an E-STOP, but it did not send a hardware command (`frontend/src/components/Factory/RobotDetailModal.tsx`, `frontend/src/App.tsx`). | In a real operations setting, an operator could believe a robot had been halted when no hardware was contacted. | Implemented: explicitly named it as a demo stop simulation and made its event log disclose that hardware was not contacted. A real emergency stop requires a separately secured and verified hardware integration. |
| P2 | The task breakdown in analytics was hard-coded and conflicted with the values in its analytics object (`frontend/src/pages/AnalyticsPage.tsx`). | Headline and detail counts disagreed. | Implemented: derive the breakdown from the same data object and label it as a seeded snapshot. |
| P2 | Mobile navigation squeezed all destinations into a short row and icon-only buttons had no explicit accessible name (`Sidebar.tsx`, `index.css`). | Small-screen navigation was difficult to scan and use with assistive technology. | Implemented: add accessible names/current-page state, a horizontally scrollable mobile nav, and 44px touch targets. |
| P2 | Conversation histories, pending confirmations, and execution state are process-global dictionaries in `chat_app.py`. | State can grow without bound, disappear on restart, and mix across workers if the service scales. | Remaining: add expiry and a bounded/persistent store keyed by authenticated user and conversation. |
| P2 | The security page's token counts, violation counts, and authenticated entity list are seeded in React; no API endpoint in the chat service supplies those values. | The screen cannot currently serve as an operational security console. | Remaining: provide authenticated backend telemetry endpoints and render loading/error/empty states from their responses. |
| P2 | Registry, agent topology, robots, and MCP tool catalogs use static frontend constants (`frontend/src/services/factoryState.ts`); only status and chat are wired through the chat API. | Changes in the running network are not reflected across most screens. | Remaining: load real registry/tool/robot data, define typed API contracts, and keep sample data behind an explicit demo mode. |
| P2 | `npm audit` reports vulnerable `vite` and transitive `esbuild` versions in the dev toolchain ([Vite path traversal advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [esbuild dev-server advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)). The Vite dev server defaults to `localhost`, but the findings matter while it is running and become more exposed if launched with `--host 0.0.0.0`. | A malicious website may target a developer's local Vite server; exposing it to the LAN increases reachability. | Remaining: plan a compatible Vite/plugin-react major upgrade and verify the dev server stays local unless LAN access is explicitly needed. |
| P3 | `run_all.py` waits for a TCP port to accept connections rather than checking each service's health endpoint. | A process can bind its port before it is ready to handle requests. | Remaining: add bounded HTTP health checks and a concise per-service readiness report. |

## Implemented in this pass

- Removed the fake connected status fallback and now refreshes backend/MCP health every 15 seconds.
- Prevented text commands from triggering the local robot simulation or reporting simulated success.
- Added real tool-result broadcasts to the dashboard WebSocket.
- Renamed the local robot stop behavior so it cannot be mistaken for a hardware E-stop.
- Added lazy-loaded pages and a loading state; the initial browser bundle dropped from 640 kB to 187 kB, with analytics loaded on demand.
- Corrected seeded/demo labels, analytics breakdown consistency, and mobile navigation semantics.
- Preserved the explicit Start demo workflow as a clearly separate local simulation.

## Validation

Validation performed: TypeScript type-check and Vite production build passed; Python sources compiled (`compileall`); chat API tests passed (2 tests); `git diff --check` passed. The full Python suite did not finish within the available run window, and the authentication tests stalled at the first OAuth test. `npm audit` reports one high and one moderate finding in Vite/esbuild; see the remaining recommendation above. No running Keycloak, MongoDB, MCP gateway, or robot hardware is assumed by this review.
