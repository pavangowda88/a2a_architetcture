import React, { useState, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar, PageId } from './components/Layout/Sidebar';
import { FactoryDashboard } from './pages/FactoryDashboard';
import { AgentNetworkPage } from './pages/AgentNetworkPage';
import { MCPControlPage } from './pages/MCPControlPage';
import { TasksPage } from './pages/TasksPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { RobotDetailModal } from './components/Factory/RobotDetailModal';
import { ProductionCompleteModal } from './components/Demo/ProductionCompleteModal';
import { ConversationMessage, TaskRun, TaskRunStatus } from './components/Chat/TaskWorkspace';

import {
  INITIAL_STATIONS,
  INITIAL_ROBOTS,
  INITIAL_PIPELINE
} from './services/factoryState';

import {
  Robot,
  Station,
  Package,
  PipelineStage,
  FactoryEvent,
  MCPToolCallLog
} from './types/factory';

import { ChatResponse, fetchSystemStatus, sendCommandToFactory } from './services/api';

function nestedValue(value: unknown, names: string[]): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = nestedValue(item, names);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const name of names) if (record[name] !== undefined) return record[name];
  for (const item of Object.values(record)) {
    const found = nestedValue(item, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function containsFailure(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsFailure);
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.success === false || record.status === 'failed' || Object.values(record).some(containsFailure);
}

function resolveRunStatus(response: ChatResponse, command: string): TaskRunStatus {
  const steps = response.steps || [];
  const stepStatuses = steps.map((step) => String(step.status || '').toLowerCase());
  if (stepStatuses.includes('waiting')) return 'waiting';
  if (stepStatuses.includes('confirmation')) return 'confirmation';
  if (stepStatuses.includes('error') || stepStatuses.includes('failed') || steps.some((step) => containsFailure(step.output))) return 'failed';
  if (/^cancel\b/i.test(command.trim()) && /cancel/i.test(response.reply || '')) return 'cancelled';
  const toolName = steps.find((step) => step.tool)?.tool || '';
  if (toolName === 'assign_task') {
    const output = steps.map((step) => step.output);
    const accepted = nestedValue(output, ['accepted']);
    const backendStatus = nestedValue(output, ['status']);
    if (accepted === true || ['accepted', 'queued', 'active'].includes(String(backendStatus || '').toLowerCase())) return 'accepted';
  }
  return 'completed';
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('factory');

  // Simulation State
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [robots, setRobots] = useState<Robot[]>(INITIAL_ROBOTS);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(INITIAL_PIPELINE);
  const [events, setEvents] = useState<FactoryEvent[]>([]);

  const [packages, setPackages] = useState<Package[]>([
    {
      id: 'P104',
      orderId: '104',
      name: 'Workpiece P104',
      currentStation: 'raw_material',
      progressPercent: 0,
      status: 'QUEUED',
      originStation: 'raw_material',
      targetStation: 'packaging',
    },
    {
      id: 'P105',
      orderId: '105',
      name: 'Workpiece P105',
      currentStation: 'raw_material',
      progressPercent: 0,
      status: 'QUEUED',
      originStation: 'raw_material',
      targetStation: 'packaging',
    },
  ]);

  const [mcpLogs, setMcpLogs] = useState<MCPToolCallLog[]>([]);

  // UI Interactive States
  const [activeConveyor, setActiveConveyor] = useState(false);
  const [laserScanning, setLaserScanning] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [showFactorySimulation, setShowFactorySimulation] = useState(false);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [activeRun, setActiveRun] = useState<TaskRun | null>(null);

  // Selected Modal State
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Backend Integration Listener
  useEffect(() => {
    const refreshStatus = () => fetchSystemStatus().then((status) => setBackendConnected(status.connected));
    refreshStatus();
    const statusTimer = window.setInterval(refreshStatus, 15000);
    return () => window.clearInterval(statusTimer);
  }, []);

  const addEvent = (
    eventType: FactoryEvent['eventType'],
    source: string,
    action: string,
    target?: string,
    status: FactoryEvent['status'] = 'success'
  ) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newEvt: FactoryEvent = {
      id: `evt-${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      eventType,
      source,
      target,
      action,
      status,
    };
    setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
  };

  const addSimulationEvent = (
    eventType: FactoryEvent['eventType'],
    source: string,
    action: string,
    target?: string,
    status: FactoryEvent['status'] = 'success'
  ) => addEvent(eventType, `Demo · ${source}`, action, target, status);

  const addMcpLog = (
    toolName: string,
    args: Record<string, any>,
    durationMs: number = 0,
    status: MCPToolCallLog['status'] = 'SUCCESS',
    result?: unknown,
    mode?: MCPToolCallLog['mode']
  ) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const log: MCPToolCallLog = {
      id: `mcp-${Date.now()}`,
      timestamp: timeStr,
      toolName,
      arguments: args,
      status,
      executionTimeMs: durationMs,
      result,
      mode,
    };
    setMcpLogs((prev) => [log, ...prev]);
  };

  const addSimulationMcpLog = (toolName: string, args: Record<string, any>) =>
    addMcpLog(toolName, args, 0, 'SUCCESS', { simulation: true, source: 'LOCAL SIMULATION' }, 'SIMULATION');

  const updatePipelineStage = (stageId: string, status: PipelineStage['status'], detail?: string) => {
    setPipeline((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, status, detail: detail || s.detail } : s))
    );
  };

  // Helper delay function
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------------- COMPLETE DEMO SCENARIO (Order #104) ----------------
  const runDemoScenario = async () => {
    if (isDemoRunning) return;
    setIsDemoRunning(true);
    setShowFactorySimulation(true);
    setCurrentPage('factory');

    // Reset pipeline & stations
    setPipeline(INITIAL_PIPELINE);
    setActiveConveyor(true);

    // 1. User Command Received
    updatePipelineStage('cmd', 'COMPLETED', 'Command: "Start production of order #104."');
    addSimulationEvent('TASK_CREATED', 'User', 'Submitted production order #104');
    await delay(700);

    // 2. LLM Analysis
    updatePipelineStage('llm', 'PROCESSING', 'Parsing intent & required tools');
    await delay(800);
    updatePipelineStage('llm', 'COMPLETED', 'Matched goal to smart factory workflow');

    // 3. Supervisor Agent
    updatePipelineStage('sup', 'PROCESSING', 'Decomposing task into station steps');
    addSimulationEvent('AGENT_MESSAGE', 'Supervisor', 'Decomposed Order #104: Material ➔ Assembly ➔ Inspection ➔ Packaging');
    await delay(900);
    updatePipelineStage('sup', 'COMPLETED', 'Task workflow initialized');

    // 4. Agent Discovery
    updatePipelineStage('disc', 'PROCESSING', 'Querying Registry for skills [pick_and_place, welding, inspection]');
    await delay(800);
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'find_robot_by_skill(skill="pick_and_place")', 'Registry');
    addSimulationMcpLog('find_robot_by_skill()', { skill: 'pick_and_place' });
    updatePipelineStage('disc', 'COMPLETED', 'Matched Robots R01, R02, R03');

    // 5. MCP Tool Selection
    updatePipelineStage('mcp_sel', 'PROCESSING', 'Selected dispatch_robot() and get_robot_status()');
    await delay(800);
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'get_robot_status()', 'MCP Server');
    addSimulationMcpLog('get_robot_status()', { robot_id: 'R01' });
    updatePipelineStage('mcp_sel', 'COMPLETED', 'MCP Tools binding verified');

    // 6. OAuth Authentication
    updatePipelineStage('oauth', 'PROCESSING', 'Keycloak introspection of Bearer token');
    await delay(900);
    addSimulationEvent('AUTH_SUCCESS', 'Keycloak', 'Token verified: scope mcp:execute', 'Robot R01');
    updatePipelineStage('oauth', 'COMPLETED', 'OAuth Access Granted');

    // 7. MCP Tool Execution: Dispatch R01 to pick package P104
    updatePipelineStage('mcp_exec', 'PROCESSING', 'Calling dispatch_robot(R01, P104)');
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'dispatch_robot(R01, P104, RAW_MATERIAL)', 'MCP Gateway');
    addSimulationMcpLog('dispatch_robot()', { robot_id: 'R01', package_id: 'P104', destination: 'RAW_MATERIAL' });
    await delay(900);
    updatePipelineStage('mcp_exec', 'COMPLETED', 'Tool executed in 38ms');

    // 8. Robot R01 picks P104 and moves to Assembly
    updatePipelineStage('robot', 'PROCESSING', 'Robot R01 moving to Assembly Station');
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R01'
          ? {
              ...r,
              status: 'MOVING',
              carryingPackageId: 'P104',
              targetLocation: 'assembly',
              x: 33,
              y: 42,
              currentTask: 'Transporting P104 to Assembly',
            }
          : r
      )
    );
    addSimulationEvent('ROBOT_PICK', 'Robot R01', 'Picked Package P104 from Raw Material Storage');
    await delay(1500);

    // R01 arrives at Assembly & hands over P104
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R01'
          ? {
              ...r,
              status: 'IDLE',
              carryingPackageId: undefined,
              location: 'raw_material',
              x: 18,
              y: 42,
              currentTask: 'Idle',
            }
          : r
      )
    );
    setPackages((prev) =>
      prev.map((p) => (p.id === 'P104' ? { ...p, currentStation: 'assembly', progressPercent: 40 } : p))
    );
    addSimulationEvent('PACKAGE_MOVED', 'Robot R01', 'Transferred P104 to Assembly Station', 'Assembly');

    // 9. Robot R02 processes assembly
    updatePipelineStage('action', 'PROCESSING', 'Robot R02 performing welding & join on P104');
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'BUSY',
              carryingPackageId: 'P104',
              currentTask: 'Welding & Joining Workpiece P104',
            }
          : r
      )
    );
    await delay(1800);

    // R02 transfers P104 to Inspection
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'MOVING',
              targetLocation: 'inspection',
              x: 63,
              y: 42,
              currentTask: 'Moving P104 to 6G Inspection',
            }
          : r
      )
    );
    await delay(1500);

    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'IDLE',
              carryingPackageId: undefined,
              location: 'assembly',
              x: 48,
              y: 42,
              currentTask: 'Idle',
            }
          : r
      )
    );
    setPackages((prev) =>
      prev.map((p) => (p.id === 'P104' ? { ...p, currentStation: 'inspection', progressPercent: 75 } : p))
    );
    addSimulationEvent('ROBOT_DELIVER', 'Robot R02', 'Delivered P104 to 6G Inspection Cell');

    // 10. R03 6G Laser Inspection Scan
    setLaserScanning(true);
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R03'
          ? {
              ...r,
              status: 'BUSY',
              currentTask: '6G Sub-millimeter Laser Scan QC',
            }
          : r
      )
    );
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'assign_task(R03, INSPECTION)', 'MCP Server');
    addSimulationMcpLog('assign_task()', { robot_id: 'R03', task: 'INSPECTION' });
    await delay(2000);
    setLaserScanning(false);

    // R03 moves P104 to Packaging
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R03'
          ? {
              ...r,
              status: 'DELIVERING',
              carryingPackageId: 'P104',
              targetLocation: 'packaging',
              x: 78,
              y: 60,
              currentTask: 'Delivering P104 to Outbound Packaging',
            }
          : r
      )
    );
    await delay(1500);

    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R03'
          ? {
              ...r,
              status: 'IDLE',
              carryingPackageId: undefined,
              location: 'inspection',
              x: 78,
              y: 42,
              currentTask: 'Idle',
            }
          : r
      )
    );
    setPackages((prev) =>
      prev.map((p) => (p.id === 'P104' ? { ...p, currentStation: 'packaging', progressPercent: 100 } : p))
    );
    addSimulationEvent('TASK_COMPLETED', 'Supervisor', 'Order #104 Completed 100%');

    // 11. Complete Stage
    updatePipelineStage('robot', 'COMPLETED', 'Robots R01, R02, R03 executed tasks');
    updatePipelineStage('action', 'COMPLETED', 'All station operations fulfilled');
    updatePipelineStage('complete', 'COMPLETED', 'ORDER #104 FULFILLED 100%');

    setActiveConveyor(false);
    setIsDemoRunning(false);
    setShowCompleteModal(true);
  };

  // ---------------- SIMULATE ROBOT FAILURE & RECOVERY SCENARIO ----------------
  const handleSimulateFailure = async () => {
    addSimulationEvent('NETWORK_EVENT', 'System', '⚡ SIMULATING ROBOT R02 FAILURE...', undefined, 'failed');

    // Mark R02 as ERROR / OFFLINE
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'ERROR',
              currentTask: 'Simulated connection loss',
            }
          : r
      )
    );
    await delay(1000);

    // Supervisor detects failure via MCP get_robot_status()
    addSimulationEvent('SECURITY_EVENT', 'Supervisor', '⚠ ROBOT R02 FAILURE DETECTED', undefined, 'failed');
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'get_robot_status()', 'MCP Server');
    addSimulationMcpLog('get_robot_status()', { status: 'OFFLINE' });
    await delay(1200);

    // Supervisor discovers replacement robot R03
    addSimulationEvent('AGENT_MESSAGE', 'Supervisor', 'Initiated failover recovery ➔ Querying backup robot with skill [welding_and_transfer]');
    addSimulationEvent('TOOL_CALL', 'Supervisor', 'find_robot_by_skill(skill="welding_and_transfer")', 'MCP Gateway');
    addSimulationMcpLog('find_robot_by_skill()', { skill: 'welding_and_transfer' });
    await delay(1200);

    // Reassign task to R03
    addSimulationEvent('TASK_STARTED', 'Supervisor', 'Reallocated assembly task to Robot R03 (Self-Healing Recovery)');
    addSimulationMcpLog('assign_task()', { robot_id: 'R03', reallocated: true });
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R03'
          ? {
              ...r,
              status: 'BUSY',
              currentTask: 'Assumed R02 Assembly Task (Recovered)',
            }
          : r
      )
    );
    await delay(1500);

    // Restore R02 back to online after diagnostics
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'IDLE',
              currentTask: 'System Recovered & Diagnostics Passed',
            }
          : r
      )
    );
    setRobots((prev) =>
      prev.map((r) => (r.id === 'R03' ? { ...r, status: 'IDLE', currentTask: 'Idle' } : r))
    );
    addSimulationEvent('TASK_COMPLETED', 'Supervisor', '✓ AGENT SELF-HEALING RECOVERY COMPLETE');
  };

  // ---------------- USER NATURAL LANGUAGE COMMAND HANDLER ----------------
  const handleSubmitCommand = async (message: string, continuation = false) => {
    if (isProcessingCommand) return;
    const previousRun = activeRun;
    const isContinuation = continuation || previousRun?.status === 'waiting' || previousRun?.status === 'confirmation';
    const requestId = isContinuation && previousRun ? previousRun.id : `run-${Date.now()}`;
    const displayCommand = isContinuation && previousRun ? previousRun.command : message;
    const startedAt = isContinuation && previousRun
      ? previousRun.startedAt
      : new Date().toLocaleTimeString('en-US', { hour12: false });
    const userText = message.toLowerCase() === 'confirm'
      ? 'Confirmed the pending operation.'
      : message.toLowerCase() === 'cancel' ? 'Cancelled the pending operation.' : message;

    setIsProcessingCommand(true);
    setShowFactorySimulation(false);
    setConversation((previous) => [...previous, { id: `user-${Date.now()}`, role: 'user', content: userText, runId: requestId }]);
    setActiveRun({
      id: requestId,
      command: displayCommand,
      status: 'submitted',
      reply: previousRun?.reply,
      steps: previousRun?.steps || [],
      startedAt,
    });
    addEvent('TASK_CREATED', 'User', `Request sent: "${displayCommand}"`, undefined, 'processing');
    const started = performance.now();

    let response: ChatResponse;
    try {
      response = await sendCommandToFactory(message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to reach the operations API';
      response = { reply: `The request could not be completed: ${detail}`, error: detail, steps: [{ status: 'error', error: detail }] };
    }

    const steps = Array.isArray(response.steps) ? response.steps : [];
    const status = response.error ? 'failed' : resolveRunStatus(response, message);
    const reply = response.reply || response.error || 'The backend returned no response text.';
    const durationMs = Math.round(performance.now() - started);
    setConversation((previous) => [...previous, { id: `assistant-${Date.now()}`, role: 'assistant', content: reply, runId: requestId }]);
    setActiveRun({ id: requestId, command: displayCommand, status, reply, steps, startedAt, durationMs });

    steps.forEach((step) => {
      const toolStatus = String(step.status || '').toLowerCase();
      const logStatus: MCPToolCallLog['status'] = ['error', 'failed'].includes(toolStatus) || containsFailure(step.output)
        ? 'FAILED'
        : ['completed', 'success'].includes(toolStatus) ? 'SUCCESS' : 'RUNNING';
      const args = step.input && typeof step.input === 'object' && !Array.isArray(step.input)
        ? step.input as Record<string, any>
        : {};
      if (step.tool) {
        addMcpLog(step.tool, args, step.duration_ms || 0, logStatus, step.output);
        addEvent('TOOL_CALL', 'MCP Gateway', `${step.tool} returned ${toolStatus || 'a response'}`, undefined, logStatus === 'FAILED' ? 'failed' : 'success');
      }
    });

    addEvent(
      status === 'failed' ? 'TASK_FAILED' : status === 'completed' ? 'TASK_COMPLETED' : status === 'accepted' ? 'TASK_ACCEPTED' : status === 'cancelled' ? 'TASK_CANCELLED' : 'AGENT_MESSAGE',
      'Operations API',
      reply,
      undefined,
      status === 'failed' ? 'failed' : status === 'submitted' ? 'processing' : status === 'cancelled' ? 'info' : 'success'
    );
    setIsProcessingCommand(false);
  };

  const handleConfirmOperation = () => handleSubmitCommand('confirm', true);
  const handleCancelOperation = () => handleSubmitCommand('cancel', true);

  const handleStopRobot = (robotId: string) => {
    setRobots((prev) =>
      prev.map((r) => (r.id === robotId ? { ...r, status: 'ERROR', currentTask: 'Locally simulated stop state' } : r))
    );
    addEvent('NETWORK_EVENT', 'Factory simulation', `Simulated stop state applied to ${robotId}; no hardware command was sent.`, undefined, 'info');
    addMcpLog('simulate_robot_stop()', { robot_id: robotId }, 0, 'SUCCESS', { simulation: true, hardware_contacted: false }, 'SIMULATION');
    setSelectedRobot(null);
  };

  const handleReset = () => {
    setStations(INITIAL_STATIONS);
    setRobots(INITIAL_ROBOTS);
    setPipeline(INITIAL_PIPELINE);
    setActiveConveyor(false);
    setLaserScanning(false);
    setIsDemoRunning(false);
    setShowFactorySimulation(false);
    setShowCompleteModal(false);
    addEvent('NETWORK_EVENT', 'System', 'Factory Simulation Reset');
  };

  return (
    <div className="app-frame flex flex-col h-screen w-screen overflow-hidden bg-[#080b12] text-slate-100 font-sans">
      {/* Top Industrial Header */}
      <Header
        gatewayStatus={backendConnected === null ? 'checking' : backendConnected ? 'connected' : 'offline'}
        modeLabel={showFactorySimulation ? 'LOCAL SIMULATION' : currentPage === 'network' ? 'PROJECT TOPOLOGY' : currentPage === 'mcp' ? 'LOCAL RUN SIMULATION' : currentPage === 'logs' ? 'SESSION EVENTS' : undefined}
        onStartDemo={runDemoScenario}
        onSimulateFailure={handleSimulateFailure}
        onReset={handleReset}
        isDemoRunning={isDemoRunning}
      />

      {/* Main App Body with Sidebar Navigation */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          activeTaskCount={0}
        />

        {/* Dynamic Page Router */}
        {currentPage === 'factory' && (
          <FactoryDashboard
            stations={stations}
            robots={robots}
            packages={packages}
            pipeline={pipeline}
            activeConveyor={activeConveyor}
            laserScanning={laserScanning}
            isProcessingCommand={isProcessingCommand}
            isCommandLocked={isProcessingCommand || activeRun?.status === 'confirmation'}
            onSubmitCommand={handleSubmitCommand}
            onSelectRobot={setSelectedRobot}
            onSelectStation={() => {}}
            onSelectPackage={() => {}}
            conversation={conversation}
            activeRun={activeRun}
            backendConnected={backendConnected}
            onConfirmOperation={handleConfirmOperation}
            onCancelOperation={handleCancelOperation}
            onClearConversation={() => setConversation([])}
            showFactorySimulation={showFactorySimulation}
            onShowTaskWorkspace={() => setShowFactorySimulation(false)}
          />
        )}

        {currentPage === 'network' && <AgentNetworkPage />}

        {currentPage === 'mcp' && (
          <MCPControlPage
            logs={mcpLogs}
            onExecuteTool={(name, args, durationMs, status, result) => {
              addMcpLog(name, args, durationMs, status, result, 'SIMULATION');
              addEvent('TOOL_CALL', 'Local Simulation', `Simulated ${name}`, 'MCP Gateway', status === 'FAILED' ? 'failed' : 'success');
            }}
            onClearSimulation={() => setMcpLogs((previous) => previous.filter((log) => log.mode !== 'SIMULATION'))}
          />
        )}

        {currentPage === 'tasks' && <TasksPage />}

        {currentPage === 'logs' && <SystemLogsPage events={events} />}
      </div>

      {/* Interactive Side Drawer Modal for Selected Robot */}
      {selectedRobot && (
        <RobotDetailModal
          robot={selectedRobot}
          onClose={() => setSelectedRobot(null)}
          onStopRobot={handleStopRobot}
        />
      )}

      {/* Order #104 Production Complete Summary Modal */}
      {showCompleteModal && (
        <ProductionCompleteModal orderId="104" onClose={() => setShowCompleteModal(false)} />
      )}
    </div>
  );
}
