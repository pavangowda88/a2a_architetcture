export type SystemStatusType = 'ONLINE' | 'DEGRADED' | 'OFFLINE';
export type ConnectionStatusType = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export type StationId = 'raw_material' | 'assembly' | 'inspection' | 'packaging';

export interface Station {
  id: StationId;
  name: string;
  code: string;
  icon: string;
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'ERROR';
  currentPackageId?: string;
  capacity: number;
  itemCount: number;
}

export type RobotStatus = 'IDLE' | 'BUSY' | 'MOVING' | 'PICKING' | 'DELIVERING' | 'ERROR' | 'OFFLINE' | 'AUTHENTICATING';

export interface Robot {
  id: string;
  name: string;
  agentId: string;
  status: RobotStatus;
  location: StationId | string;
  targetLocation?: StationId | string;
  x: number; // 0 to 100 percentage layout
  y: number;
  battery: number;
  speed: number; // m/s
  carryingPackageId?: string;
  currentTask?: string;
  skill: string;
  maxPayloadKg: number;
  oauthStatus: 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'EXPIRED';
  mcpAccess: boolean;
  imsi: string;
  imei: string;
  lastAction: string;
  lastActionTime: string;
}

export interface Package {
  id: string;
  orderId: string;
  name: string;
  currentStation: StationId | 'in_transit';
  progressPercent: number;
  status: 'QUEUED' | 'MATERIAL_READY' | 'ASSEMBLING' | 'INSPECTING' | 'PACKAGING' | 'COMPLETED' | 'FAILED';
  attachedToRobotId?: string;
  originStation: StationId;
  targetStation: StationId;
}

export type AgentRole = 'Supervisor' | 'AUSF' | 'UDM' | 'Security' | 'Robot' | 'Registry' | 'MCP';
export type AgentState = 'ACTIVE' | 'PROCESSING' | 'WAITING' | 'ERROR' | 'OFFLINE';

export interface FactoryAgent {
  id: string;
  name: string;
  role: AgentRole;
  port: number;
  state: AgentState;
  skills: string[];
  lastAction: string;
  lastActionTime: string;
  oauthStatus: 'AUTHENTICATED' | 'AUTHORIZED' | 'PENDING';
  trustScore: number;
  imsi?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  category: 'robot' | 'factory' | 'auth' | 'network';
}

export interface MCPToolCallLog {
  id: string;
  timestamp: string;
  toolName: string;
  arguments: Record<string, any>;
  status: 'SUCCESS' | 'RUNNING' | 'FAILED';
  executionTimeMs: number;
  result?: any;
}

export interface PipelineStage {
  id: string;
  label: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  detail?: string;
  time?: string;
}

export type EventType =
  | 'AGENT_ONLINE'
  | 'AGENT_OFFLINE'
  | 'AGENT_MESSAGE'
  | 'TASK_CREATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'AUTH_REQUEST'
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'ROBOT_MOVE'
  | 'ROBOT_PICK'
  | 'ROBOT_DELIVER'
  | 'PACKAGE_MOVED'
  | 'NETWORK_EVENT'
  | 'SECURITY_EVENT';

export interface FactoryEvent {
  id: string;
  timestamp: string;
  eventType: EventType;
  source: string;
  target?: string;
  action: string;
  status: 'success' | 'processing' | 'failed' | 'info';
  data?: Record<string, any>;
}

export interface A2APacketAnimation {
  id: string;
  fromAgent: string;
  toAgent: string;
  label: string; // e.g. TASK_REQUEST, AUTH_REQUEST, TOOL_CALL
  type: 'auth' | 'task' | 'mcp' | 'result';
}

export interface FactoryAnalyticsData {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  mcpCalls: number;
  agentMessages: number;
  avgTaskTimeSec: number;
  networkLatencyMs: number;
  robotUtilization: { name: string; utilization: number }[];
  taskTrends: { time: string; tasks: number; mcpCalls: number }[];
  throughput: { hour: string; packages: number }[];
}

export interface SecurityStatus {
  keycloakConnected: boolean;
  oauthActive: boolean;
  activeTokensCount: number;
  unauthorizedCallsCount: number;
  securityEventsCount: number;
  lastIntrospection: string;
}
