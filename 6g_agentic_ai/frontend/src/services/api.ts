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

export interface ManagedTask {
  task_id?: string;
  session_id?: string;
  task?: string;
  skill?: string;
  agent_id?: string;
  status?: string;
  payload_kg?: number;
  created_at?: string;
  updated_at?: string;
  error?: string;
}

function taskApiError(body: { detail?: unknown }, status: number, fallback: string) {
  if (status === 404) return 'The task API is not available yet. Restart the operations service and try again.';
  return typeof body.detail === 'string' ? body.detail : fallback;
}

export async function fetchTasks(): Promise<ManagedTask[]> {
  const res = await fetch(`${API_BASE}/tasks`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(taskApiError(body, res.status, `Operations API returned HTTP ${res.status}`));
  return Array.isArray(body.tasks) ? body.tasks as ManagedTask[] : [];
}

export async function assignTask(task: string, skill: string, payloadKg: number) {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, ...(skill ? { skill } : {}), payload_kg: payloadKg }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(taskApiError(body, res.status, `Task assignment failed (HTTP ${res.status})`));
  return body;
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
