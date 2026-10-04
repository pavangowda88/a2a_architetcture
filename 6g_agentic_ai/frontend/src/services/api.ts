import { FactoryEvent, Robot, FactoryAgent, MCPToolCallLog, MCPToolDefinition, SecurityStatus } from '../types/factory';

const API_BASE = '/api';

export interface SystemStatusResponse {
  connected: boolean;
  server?: string;
  tool_count?: number;
  tools?: MCPToolDefinition[];
  llm_enabled?: boolean;
  llm_model?: string | null;
  error?: string;
}

export interface ChatResponse {
  reply?: string;
  steps?: Array<{
    tool?: string;
    status?: string;
    duration_ms?: number;
    input?: unknown;
    output?: unknown;
    error?: string;
  }>;
  error?: string;
}

export async function fetchSystemStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as SystemStatusResponse;
  } catch {
    return { connected: false, error: 'Operations API unavailable' } satisfies SystemStatusResponse;
  }
}

export async function sendCommandToFactory(message: string, conversationId: string = 'demo-conv-001') {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, message, developer_mode: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof body.detail === 'string' ? body.detail : `Operations API returned HTTP ${res.status}`;
    throw new Error(detail);
  }
  return body as ChatResponse;
}

export async function fetchAgentsFromRegistry() {
  try {
    const res = await fetch(`${API_BASE}/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function fetchRobotSimulationState() {
  try {
    const res = await fetch(`${API_BASE}/robot-simulation`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export class FactoryWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: ((event: FactoryEvent) => void)[] = [];

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          this.listeners.forEach((cb) => cb(data));
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };
      this.ws.onclose = () => {
        setTimeout(() => this.connect(), 3000);
      };
    } catch (e) {
      console.warn('WebSocket connection not available; operating in high-performance local event bus mode.');
    }
  }

  onEvent(callback: (event: FactoryEvent) => void) {
    this.listeners.push(callback);
  }
}

export const factoryWs = new FactoryWebSocketClient();
