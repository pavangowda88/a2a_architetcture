import React, { useState, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { Sidebar, PageId } from './components/Layout/Sidebar';
import { FactoryDashboard } from './pages/FactoryDashboard';
import { AgentNetworkPage } from './pages/AgentNetworkPage';
import { MCPControlPage } from './pages/MCPControlPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { TasksPage } from './pages/TasksPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { RobotDetailModal } from './components/Factory/RobotDetailModal';
import { ProductionCompleteModal } from './components/Demo/ProductionCompleteModal';

import {
  INITIAL_STATIONS,
  INITIAL_ROBOTS,
  INITIAL_AGENTS,
  INITIAL_PIPELINE,
  AVAILABLE_MCP_TOOLS
} from './services/factoryState';

import {
  Robot,
  Station,
  Package,
  FactoryAgent,
  PipelineStage,
  FactoryEvent,
  MCPToolCallLog,
  FactoryAnalyticsData,
  SecurityStatus
} from './types/factory';

import { fetchSystemStatus, sendCommandToFactory, factoryWs } from './services/api';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('factory');

  // Simulation State
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [robots, setRobots] = useState<Robot[]>(INITIAL_ROBOTS);
  const [agents, setAgents] = useState<FactoryAgent[]>(INITIAL_AGENTS);
  const [pipeline, setPipeline] = useState<PipelineStage[]>(INITIAL_PIPELINE);
  const [events, setEvents] = useState<FactoryEvent[]>([
    {
      id: 'init-1',
      timestamp: '10:42:00',
      eventType: 'AGENT_ONLINE',
      source: 'SupervisorAgent',
      action: 'System initialized and connected to 6G Subnet',
      status: 'success',
    },
    {
      id: 'init-2',
      timestamp: '10:42:01',
      eventType: 'AUTH_SUCCESS',
      source: 'Keycloak',
      target: 'MCP Server',
      action: 'OAuth 2.0 Token Issued (mcp:execute)',
      status: 'success',
    },
  ]);

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

  const [mcpLogs, setMcpLogs] = useState<MCPToolCallLog[]>([
    {
      id: 'log-1',
      timestamp: '10:42:02',
      toolName: 'get_factory_status()',
      arguments: {},
      status: 'SUCCESS',
      executionTimeMs: 12,
    },
  ]);

  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>({
    keycloakConnected: true,
    oauthActive: true,
    activeTokensCount: 4,
    unauthorizedCallsCount: 0,
    securityEventsCount: 0,
    lastIntrospection: '10:42:05',
  });

  const [analytics, setAnalytics] = useState<FactoryAnalyticsData>({
    totalTasks: 47,
    activeTasks: 2,
    completedTasks: 35,
    failedTasks: 0,
    mcpCalls: 124,
    agentMessages: 356,
    avgTaskTimeSec: 12.4,
    networkLatencyMs: 12,
    robotUtilization: [
      { name: 'Robot R01', utilization: 85 },
      { name: 'Robot R02', utilization: 92 },
      { name: 'Robot R03', utilization: 78 },
    ],
    taskTrends: [
      { time: '10:00', tasks: 4, mcpCalls: 12 },
      { time: '10:10', tasks: 8, mcpCalls: 24 },
      { time: '10:20', tasks: 15, mcpCalls: 45 },
      { time: '10:30', tasks: 28, mcpCalls: 85 },
      { time: '10:40', tasks: 47, mcpCalls: 124 },
    ],
    throughput: [
      { hour: '08:00', packages: 12 },
      { hour: '09:00', packages: 18 },
      { hour: '10:00', packages: 25 },
    ],
  });

  // UI Interactive States
  const [activeConveyor, setActiveConveyor] = useState(false);
  const [laserScanning, setLaserScanning] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  // Selected Modal State
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Backend Integration Listener
  useEffect(() => {
    fetchSystemStatus();
    factoryWs.connect();
    factoryWs.onEvent((evt) => {
      setEvents((prev) => [evt, ...prev.slice(0, 49)]);
    });
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

  const addMcpLog = (toolName: string, args: Record<string, any>, durationMs: number = 42) => {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    const log: MCPToolCallLog = {
      id: `mcp-${Date.now()}`,
      timestamp: timeStr,
      toolName,
      arguments: args,
      status: 'SUCCESS',
      executionTimeMs: durationMs,
    };
    setMcpLogs((prev) => [log, ...prev]);
    setAnalytics((prev) => ({ ...prev, mcpCalls: prev.mcpCalls + 1 }));
  };

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
    setCurrentPage('factory');

    // Reset pipeline & stations
    setPipeline(INITIAL_PIPELINE);
    setActiveConveyor(true);

    // 1. User Command Received
    updatePipelineStage('cmd', 'COMPLETED', 'Command: "Start production of order #104."');
    addEvent('TASK_CREATED', 'User', 'Submitted production order #104');
    await delay(700);

    // 2. LLM Analysis
    updatePipelineStage('llm', 'PROCESSING', 'Parsing intent & required tools');
    await delay(800);
    updatePipelineStage('llm', 'COMPLETED', 'Matched goal to smart factory workflow');

    // 3. Supervisor Agent
    updatePipelineStage('sup', 'PROCESSING', 'Decomposing task into station steps');
    addEvent('AGENT_MESSAGE', 'Supervisor', 'Decomposed Order #104: Material ➔ Assembly ➔ Inspection ➔ Packaging');
    await delay(900);
    updatePipelineStage('sup', 'COMPLETED', 'Task workflow initialized');

    // 4. Agent Discovery
    updatePipelineStage('disc', 'PROCESSING', 'Querying Registry for skills [pick_and_place, welding, inspection]');
    await delay(800);
    addEvent('TOOL_CALL', 'Supervisor', 'find_robot_by_skill(skill="pick_and_place")', 'Registry');
    addMcpLog('find_robot_by_skill()', { skill: 'pick_and_place' });
    updatePipelineStage('disc', 'COMPLETED', 'Matched Robots R01, R02, R03');

    // 5. MCP Tool Selection
    updatePipelineStage('mcp_sel', 'PROCESSING', 'Selected dispatch_robot() and get_robot_status()');
    await delay(800);
    addEvent('TOOL_CALL', 'Supervisor', 'get_robot_status()', 'MCP Server');
    addMcpLog('get_robot_status()', { robot_id: 'R01' });
    updatePipelineStage('mcp_sel', 'COMPLETED', 'MCP Tools binding verified');

    // 6. OAuth Authentication
    updatePipelineStage('oauth', 'PROCESSING', 'Keycloak introspection of Bearer token');
    await delay(900);
    addEvent('AUTH_SUCCESS', 'Keycloak', 'Token verified: scope mcp:execute', 'Robot R01');
    updatePipelineStage('oauth', 'COMPLETED', 'OAuth Access Granted');

    // 7. MCP Tool Execution: Dispatch R01 to pick package P104
    updatePipelineStage('mcp_exec', 'PROCESSING', 'Calling dispatch_robot(R01, P104)');
    addEvent('TOOL_CALL', 'Supervisor', 'dispatch_robot(R01, P104, RAW_MATERIAL)', 'MCP Gateway');
    addMcpLog('dispatch_robot()', { robot_id: 'R01', package_id: 'P104', destination: 'RAW_MATERIAL' });
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
    addEvent('ROBOT_PICK', 'Robot R01', 'Picked Package P104 from Raw Material Storage');
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
    addEvent('PACKAGE_MOVED', 'Robot R01', 'Transferred P104 to Assembly Station', 'Assembly');

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
    addEvent('ROBOT_DELIVER', 'Robot R02', 'Delivered P104 to 6G Inspection Cell');

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
    addEvent('TOOL_CALL', 'Supervisor', 'assign_task(R03, INSPECTION)', 'MCP Server');
    addMcpLog('assign_task()', { robot_id: 'R03', task: 'INSPECTION' });
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
    addEvent('TASK_COMPLETED', 'Supervisor', 'Order #104 Completed 100%');

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
    addEvent('NETWORK_EVENT', 'System', '⚡ SIMULATING ROBOT R02 FAILURE...', undefined, 'failed');

    // Mark R02 as ERROR / OFFLINE
    setRobots((prev) =>
      prev.map((r) =>
        r.id === 'R02'
          ? {
              ...r,
              status: 'ERROR',
              currentTask: 'CONNECTION LOST / E-STOP',
            }
          : r
      )
    );
    await delay(1000);

    // Supervisor detects failure via MCP get_robot_status()
    addEvent('SECURITY_EVENT', 'Supervisor', '⚠ ROBOT R02 FAILURE DETECTED', undefined, 'failed');
    addEvent('TOOL_CALL', 'Supervisor', 'get_robot_status()', 'MCP Server');
    addMcpLog('get_robot_status()', { status: 'OFFLINE' });
    await delay(1200);

    // Supervisor discovers replacement robot R03
    addEvent('AGENT_MESSAGE', 'Supervisor', 'Initiated failover recovery ➔ Querying backup robot with skill [welding_and_transfer]');
    addEvent('TOOL_CALL', 'Supervisor', 'find_robot_by_skill(skill="welding_and_transfer")', 'MCP Gateway');
    addMcpLog('find_robot_by_skill()', { skill: 'welding_and_transfer' });
    await delay(1200);

    // Reassign task to R03
    addEvent('TASK_STARTED', 'Supervisor', 'Reallocated assembly task to Robot R03 (Self-Healing Recovery)');
    addMcpLog('assign_task()', { robot_id: 'R03', reallocated: true });
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
    addEvent('TASK_COMPLETED', 'Supervisor', '✓ AGENT SELF-HEALING RECOVERY COMPLETE');
  };

  // ---------------- USER NATURAL LANGUAGE COMMAND HANDLER ----------------
  const handleSubmitCommand = async (command: string) => {
    setIsProcessingCommand(true);
    addEvent('TASK_CREATED', 'User', `Command: "${command}"`);

    // Try real backend first
    const backendResult = await sendCommandToFactory(command);
    if (backendResult && backendResult.reply) {
      addEvent('AGENT_MESSAGE', 'Supervisor / LLM', backendResult.reply);
    }

    // Trigger demo execution scenario
    if (command.toLowerCase().includes('104') || command.toLowerCase().includes('start')) {
      await runDemoScenario();
    } else {
      // Simulate general command processing
      updatePipelineStage('cmd', 'COMPLETED', command);
      await delay(500);
      updatePipelineStage('llm', 'COMPLETED', 'Command interpreted');
      await delay(500);
      updatePipelineStage('mcp_exec', 'COMPLETED', 'MCP Tool executed');
      await delay(500);
      updatePipelineStage('complete', 'COMPLETED', 'Action completed');
    }

    setIsProcessingCommand(false);
  };

  const handleStopRobot = (robotId: string) => {
    setRobots((prev) =>
      prev.map((r) => (r.id === robotId ? { ...r, status: 'ERROR', currentTask: 'E-STOP HALTED' } : r))
    );
    addEvent('SECURITY_EVENT', 'User', `Emergency Stop issued for ${robotId}`, undefined, 'failed');
    addMcpLog('stop_robot()', { robot_id: robotId });
    setSelectedRobot(null);
  };

  const handleReset = () => {
    setStations(INITIAL_STATIONS);
    setRobots(INITIAL_ROBOTS);
    setAgents(INITIAL_AGENTS);
    setPipeline(INITIAL_PIPELINE);
    setActiveConveyor(false);
    setLaserScanning(false);
    setIsDemoRunning(false);
    setShowCompleteModal(false);
    addEvent('NETWORK_EVENT', 'System', 'Factory Simulation Reset');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080b12] text-slate-100 font-sans">
      {/* Top Industrial Header */}
      <Header
        systemStatus="ONLINE"
        mcpConnected={true}
        networkConnected={true}
        authActive={true}
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
          activeTaskCount={packages.filter((p) => p.progressPercent < 100).length}
        />

        {/* Dynamic Page Router */}
        {currentPage === 'factory' && (
          <FactoryDashboard
            stations={stations}
            robots={robots}
            packages={packages}
            agents={agents}
            pipeline={pipeline}
            events={events}
            activeConveyor={activeConveyor}
            laserScanning={laserScanning}
            isProcessingCommand={isProcessingCommand}
            onSubmitCommand={handleSubmitCommand}
            onSelectRobot={setSelectedRobot}
            onSelectStation={() => {}}
            onSelectPackage={() => {}}
            onSelectAgent={() => {}}
          />
        )}

        {currentPage === 'network' && <AgentNetworkPage agents={agents} robots={robots} />}

        {currentPage === 'mcp' && (
          <MCPControlPage
            logs={mcpLogs}
            onExecuteTool={(name, args) => {
              addMcpLog(name, args);
              addEvent('TOOL_CALL', 'User', `Executed ${name}`, 'MCP Gateway');
            }}
          />
        )}

        {currentPage === 'security' && <SecurityCenterPage security={securityStatus} />}

        {currentPage === 'tasks' && <TasksPage packages={packages} />}

        {currentPage === 'analytics' && <AnalyticsPage analytics={analytics} />}

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
