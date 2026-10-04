import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronRight, CircleHelp, Clock3, Code2, LoaderCircle, Play, RotateCcw, Search, Server, ShieldAlert, SlidersHorizontal, XCircle } from 'lucide-react';
import { fetchSystemStatus } from '../services/api';
import { createInitialSimulationState, MCPSimulationState, simulateMCPTool } from '../services/mcpSimulation';
import { MCPToolCallLog, MCPToolDefinition } from '../types/factory';

interface MCPControlPageProps {
  logs: MCPToolCallLog[];
  onExecuteTool: (toolName: string, args: Record<string, unknown>, durationMs: number, status: MCPToolCallLog['status'], result: unknown) => void;
  onClearSimulation: () => void;
}

interface ToolProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: { type?: string };
}

interface ToolRun {
  toolName: string;
  args: Record<string, unknown>;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED';
  result: Record<string, unknown>;
  time: string;
}

type StageStatus = 'pending' | 'active' | 'completed' | 'failed';

const STAGE_LABELS = ['Request validated', 'Tool routed', 'Local state simulated', 'Result returned'];
const ASSIGNMENT_STAGES = ['Request validated', 'Robot selected', 'Dispatch queued', 'Robot at pickup', 'Package secured', 'In transit', 'Package delivered'];
const STATION_LABELS: Record<string, string> = {
  raw_material: 'Raw material',
  assembly: 'Assembly',
  inspection: 'Inspection',
  packaging: 'Packaging',
};
const STATION_POSITIONS: Record<string, number> = {
  raw_material: 11,
  assembly: 37,
  inspection: 63,
  packaging: 89,
};

interface AssignmentDemo {
  agentId: string;
  robotName: string;
  taskId: string;
  task: string;
  packageId: string;
  origin: string;
  destination: string;
  stage: string;
  stageIndex: number;
  progress: number;
  robotPosition: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

function normalizeStation(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized.includes('raw') || normalized.includes('material') || normalized.includes('storage')) return 'raw_material';
  if (normalized.includes('assembly') || normalized.includes('weld')) return 'assembly';
  if (normalized.includes('inspection') || normalized.includes('inspect')) return 'inspection';
  if (normalized.includes('pack')) return 'packaging';
  return fallback;
}

function assignmentContext(args: Record<string, unknown>, outcome: Record<string, unknown>, simulation: MCPSimulationState): Omit<AssignmentDemo, 'stage' | 'stageIndex' | 'progress' | 'robotPosition' | 'status' | 'error'> {
  const agentId = String(outcome.agent_id ?? args.agent_id ?? '');
  const agent = simulation.agents.find((item) => item.id === agentId);
  const rawLocations = args.locations && typeof args.locations === 'object' ? args.locations as Record<string, unknown> : {};
  const task = String(args.task ?? 'Assigned robot task');
  const rawPayload = args.payload && typeof args.payload === 'object' ? args.payload as Record<string, unknown> : {};
  const packageMatch = task.match(/\bP\d+\b/i);
  const result = outcome.result && typeof outcome.result === 'object' ? outcome.result as Record<string, unknown> : {};
  return {
    agentId,
    robotName: agent?.name || agentId || 'Robot',
    taskId: String(result.task_id ?? 'SIM-TASK'),
    task,
    packageId: String(rawPayload.package_id ?? rawPayload.id ?? packageMatch?.[0] ?? 'P104'),
    origin: normalizeStation(rawLocations.origin ?? rawLocations.from ?? rawLocations.pickup, 'raw_material'),
    destination: normalizeStation(rawLocations.destination ?? rawLocations.to ?? rawLocations.target, 'packaging'),
  };
}

const EXAMPLE_ARGUMENTS: Record<string, Record<string, unknown>> = {
  register: { agent_id: 'ue_agent_sim_004', agent_name: 'Simulation Robot 04', agent_type: 'industrial_arm', imsi: '001010000000004', imei: 'SIM-IMEI-0004', endpoint: 'http://localhost:8109', skills: ['pick_and_place'], services: ['robotics'], metadata: { max_payload_kg: 30 } },
  authenticate: { agent_id: 'ue_agent_001', imsi: '001010123456789', imei: 'imei-123456789', simulate_low_trust: false },
  assign_task: { task: 'Move demo package P104 to inspection', payload_kg: 2, payload: { package_id: 'P104' }, agent_id: 'ue_agent_001', locations: { origin: 'raw_material', destination: 'inspection' }, skill: 'pick_and_place' },
  end_task_session: { session_id: 'SIM-SESSION-0001' },
  end_all_task_sessions: { agent_id: 'ue_agent_001' },
  find_robot_by_skill: { skill: 'pick_and_place' },
  list_agents_by_skill: { skill: 'pick_and_place' },
  get_ue_inbox: { ue_agent_id: 'ue_agent_001' },
  find_agent: { agent_id: 'ue_agent_001' },
  list_active_sessions: {},
};

function propertiesFor(tool: MCPToolDefinition): Record<string, ToolProperty> {
  const properties = tool.inputSchema?.properties;
  return properties && typeof properties === 'object' ? properties as Record<string, ToolProperty> : {};
}

function requiredFor(tool: MCPToolDefinition): string[] {
  const required = tool.inputSchema?.required;
  return Array.isArray(required) ? required.filter((item): item is string => typeof item === 'string') : [];
}

function encodeField(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function exampleForm(tool: MCPToolDefinition): Record<string, string> {
  const properties = propertiesFor(tool);
  const examples = EXAMPLE_ARGUMENTS[tool.name] ?? {};
  return Object.fromEntries(Object.entries(properties).map(([key, property]) => [key, encodeField(examples[key] ?? property.default)]));
}

function parseArguments(tool: MCPToolDefinition, values: Record<string, string>): { args: Record<string, unknown>; errors: Record<string, string> } {
  const properties = propertiesFor(tool);
  const required = requiredFor(tool);
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const [key, property] of Object.entries(properties)) {
    const raw = values[key]?.trim() ?? '';
    if (!raw) {
      if (required.includes(key)) errors[key] = 'This field is required.';
      continue;
    }
    try {
      if (property.type === 'boolean') {
        args[key] = raw === 'true';
      } else if (property.type === 'number' || property.type === 'integer') {
        const number = Number(raw);
        if (!Number.isFinite(number) || (property.type === 'integer' && !Number.isInteger(number))) {
          errors[key] = property.type === 'integer' ? 'Enter a whole number.' : 'Enter a valid number.';
        } else {
          args[key] = number;
        }
      } else if (property.type === 'array') {
        const valuesArray = raw.startsWith('[')
          ? JSON.parse(raw) as unknown
          : raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
        if (!Array.isArray(valuesArray)) errors[key] = 'Enter a JSON array or comma-separated values.';
        else args[key] = valuesArray;
      } else if (property.type === 'object') {
        const object = JSON.parse(raw) as unknown;
        if (!object || typeof object !== 'object' || Array.isArray(object)) errors[key] = 'Enter a JSON object.';
        else args[key] = object;
      } else {
        args[key] = raw;
      }
    } catch {
      errors[key] = property.type === 'array' ? 'Enter valid JSON or comma-separated values.' : 'Enter valid JSON.';
    }
  }
  return { args, errors };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function assignmentPosition(stageIndex: number, origin: string, destination: string): number {
  const start = STATION_POSITIONS[origin] ?? STATION_POSITIONS.raw_material;
  const end = STATION_POSITIONS[destination] ?? STATION_POSITIONS.packaging;
  if (stageIndex <= 3) return start;
  if (stageIndex === 4) return start;
  if (stageIndex === 5) return start + (end - start) * 0.58;
  return end;
}

const AssignmentSimulationView: React.FC<{ demo: AssignmentDemo }> = ({ demo }) => {
  const sourcePosition = STATION_POSITIONS[demo.origin] ?? STATION_POSITIONS.raw_material;
  const destinationPosition = STATION_POSITIONS[demo.destination] ?? STATION_POSITIONS.packaging;
  const checkpoints = [
    { label: 'Robot dispatched', complete: demo.stageIndex >= 2 },
    { label: 'Package picked up', complete: demo.stageIndex >= 4 },
    { label: 'Destination handoff', complete: demo.status === 'completed' },
  ];

  return (
    <section className={`mcp-task-demo ${demo.status}`} aria-label="Robot assignment simulation" aria-live="polite">
      <div className="mcp-task-demo-header">
        <div>
          <span className="mcp-demo-kicker">ROBOT TASK SIMULATION</span>
          <h3>{demo.task}</h3>
        </div>
        <span className={`mcp-demo-status ${demo.status}`}><i />{demo.status === 'running' ? demo.stage : demo.status === 'completed' ? 'Delivery complete' : 'Assignment rejected'}</span>
      </div>

      <div className="mcp-floor-scene">
        <svg className="mcp-floor-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="11" y1="47" x2="89" y2="47" className="mcp-route-base" />
          <line x1={sourcePosition} y1="47" x2={destinationPosition} y2="47" className="mcp-route-active" />
        </svg>
        {Object.entries(STATION_LABELS).map(([id, label]) => <div key={id} className={`mcp-floor-station ${id === demo.origin ? 'is-origin' : ''} ${id === demo.destination && demo.status === 'completed' ? 'is-destination' : ''}`} style={{ left: `${STATION_POSITIONS[id]}%` }}>
          <span className="mcp-station-marker" />
          <strong>{label}</strong>
          <small>{id === demo.origin ? 'PICKUP' : id === demo.destination ? 'DROP-OFF' : 'WORKCELL'}</small>
          {id === demo.origin && demo.stageIndex < 4 && <span className="mcp-package-token at-station">{demo.packageId}</span>}
          {id === demo.destination && demo.status === 'completed' && <span className="mcp-package-token delivered">{demo.packageId} · DELIVERED</span>}
        </div>)}
        <div className={`mcp-robot-token ${demo.status}`} style={{ left: `${demo.robotPosition}%` }}>
          <span className="mcp-robot-glyph">R</span>
          <strong>{demo.robotName}</strong>
          <small>{demo.agentId}</small>
          {demo.stageIndex >= 4 && demo.status !== 'failed' && demo.status !== 'completed' && <span className="mcp-package-token carried">{demo.packageId}</span>}
        </div>
      </div>

      <div className="mcp-task-demo-progress">
        <div><span>Mission progress</span><strong>{demo.status === 'failed' ? 'Stopped' : `${demo.progress}%`}</strong></div>
        <div className="mcp-progress-track"><i style={{ width: `${demo.progress}%` }} /></div>
        <div className="mcp-task-demo-meta"><span><b>Task</b>{demo.taskId}</span><span><b>Route</b>{STATION_LABELS[demo.origin]} → {STATION_LABELS[demo.destination]}</span><span><b>Package</b>{demo.packageId}</span></div>
      </div>

      <ol className="mcp-task-checkpoints">
        {checkpoints.map((checkpoint) => <li key={checkpoint.label} className={checkpoint.complete ? 'complete' : ''}><span>{checkpoint.complete ? <Check size={11} /> : null}</span>{checkpoint.label}</li>)}
      </ol>
      {demo.error && <p className="mcp-task-demo-error"><AlertCircle size={14} />{demo.error}</p>}
    </section>
  );
};

export const MCPControlPage: React.FC<MCPControlPageProps> = ({ logs, onExecuteTool, onClearSimulation }) => {
  const [tools, setTools] = useState<MCPToolDefinition[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [simulation, setSimulation] = useState<MCPSimulationState>(createInitialSimulationState);
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [latestRun, setLatestRun] = useState<ToolRun | null>(null);
  const [assignmentDemo, setAssignmentDemo] = useState<AssignmentDemo | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const status = await fetchSystemStatus();
      if (!mounted) return;
      const discovered = Array.isArray(status.tools) ? status.tools : [];
      setConnected(status.connected);
      setConnectionError(status.connected ? '' : status.error || 'MCP gateway is unavailable.');
      setTools(discovered);
      setSelectedName((current) => {
        if (discovered.some((tool) => tool.name === current)) return current;
        const firstTool = discovered[0];
        setValues(firstTool ? exampleForm(firstTool) : {});
        setFieldErrors({});
        return firstTool?.name ?? '';
      });
      setLoading(false);
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const selectedTool = tools.find((tool) => tool.name === selectedName) ?? null;
  const runStageLabels = selectedTool?.name === 'assign_task' ? ASSIGNMENT_STAGES : STAGE_LABELS;
  const fieldDefinitions = useMemo(() => selectedTool ? Object.entries(propertiesFor(selectedTool)) : [], [selectedTool]);
  const visibleLogs = useMemo(() => {
    const names = new Set(tools.map((tool) => tool.name));
    return logs.filter((log) => names.has(log.toolName)).slice(0, 30);
  }, [logs, tools]);

  const selectTool = (tool: MCPToolDefinition) => {
    setSelectedName(tool.name);
    setValues(exampleForm(tool));
    setFieldErrors({});
  };

  const loadExample = () => {
    if (!selectedTool) return;
    setValues(exampleForm(selectedTool));
    setFieldErrors({});
  };

  const runSimulation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTool || running) return;
    const parsed = parseArguments(selectedTool, values);
    setFieldErrors(parsed.errors);
    if (Object.keys(parsed.errors).length > 0) return;

    setRunning(true);
    setLatestRun(null);
    setAssignmentDemo(null);
    const started = performance.now();
    try {
      const outcome = simulateMCPTool(selectedTool.name, parsed.args, simulation);
      if (selectedTool.name === 'assign_task' && outcome.result.success !== false) {
        const context = assignmentContext(parsed.args, outcome.result, simulation);
        setStages(ASSIGNMENT_STAGES.map((_, index) => index === 0 ? 'active' : 'pending'));
        setAssignmentDemo({ ...context, stage: ASSIGNMENT_STAGES[0], stageIndex: 0, progress: 0, robotPosition: assignmentPosition(0, context.origin, context.destination), status: 'running' });
        for (let index = 0; index < ASSIGNMENT_STAGES.length; index += 1) {
          setStages(ASSIGNMENT_STAGES.map((_, stageIndex) => stageIndex < index ? 'completed' : stageIndex === index ? 'active' : 'pending'));
          setAssignmentDemo({ ...context, stage: ASSIGNMENT_STAGES[index], stageIndex: index, progress: Math.round((index / (ASSIGNMENT_STAGES.length - 1)) * 100), robotPosition: assignmentPosition(index, context.origin, context.destination), status: 'running' });
          await wait(900);
        }
        const completedState: MCPSimulationState = {
          ...outcome.nextState,
          sessions: outcome.nextState.sessions.map((session) => session.task_id === context.taskId ? { ...session, status: 'completed' } : session),
        };
        const result = {
          ...outcome.result,
          simulation_execution: { status: 'completed', task_id: context.taskId, agent_id: context.agentId, package_id: context.packageId, destination: context.destination },
          session: { ...(outcome.result.session as Record<string, unknown>), status: 'completed' },
        };
        const durationMs = Math.round(performance.now() - started);
        const run: ToolRun = { toolName: selectedTool.name, args: parsed.args, durationMs, status: 'SUCCESS', result, time: new Date().toLocaleTimeString('en-US', { hour12: false }) };
        setSimulation(completedState);
        setAssignmentDemo({ ...context, stage: 'Task delivered', stageIndex: ASSIGNMENT_STAGES.length - 1, progress: 100, robotPosition: assignmentPosition(ASSIGNMENT_STAGES.length - 1, context.origin, context.destination), status: 'completed' });
        setStages(ASSIGNMENT_STAGES.map(() => 'completed'));
        setLatestRun(run);
        onExecuteTool(selectedTool.name, parsed.args, durationMs, 'SUCCESS', result);
        setRunning(false);
        return;
      }

      if (selectedTool.name === 'assign_task' && outcome.result.success === false) {
        const context = assignmentContext(parsed.args, outcome.result, simulation);
        setAssignmentDemo({ ...context, stage: 'Assignment rejected', stageIndex: 0, progress: 0, robotPosition: assignmentPosition(0, context.origin, context.destination), status: 'failed', error: String(outcome.result.error ?? 'No simulated robot could accept this task.') });
      }

      setStages(STAGE_LABELS.map((_, index) => index === 0 ? 'active' : 'pending'));
      for (let index = 0; index < STAGE_LABELS.length; index += 1) {
        setStages(STAGE_LABELS.map((_, stageIndex) => stageIndex < index ? 'completed' : stageIndex === index ? 'active' : 'pending'));
        await wait(140);
      }
      setSimulation(outcome.nextState);
      const durationMs = Math.round(performance.now() - started);
      const status = outcome.result.success === false ? 'FAILED' : 'SUCCESS';
      const run: ToolRun = { toolName: selectedTool.name, args: parsed.args, durationMs, status, result: outcome.result, time: new Date().toLocaleTimeString('en-US', { hour12: false }) };
      setLatestRun(run);
      setStages(STAGE_LABELS.map((_, index) => index === STAGE_LABELS.length - 1 && status === 'FAILED' ? 'failed' : 'completed'));
      onExecuteTool(selectedTool.name, parsed.args, durationMs, status, outcome.result);
    } catch (error) {
      const durationMs = Math.round(performance.now() - started);
      const result = { simulation: true, source: 'LOCAL SIMULATION', success: false, error: error instanceof Error ? error.message : 'Simulation failed.' };
      setLatestRun({ toolName: selectedTool.name, args: parsed.args, durationMs, status: 'FAILED', result, time: new Date().toLocaleTimeString('en-US', { hour12: false }) });
      setStages(STAGE_LABELS.map((_, index) => index === STAGE_LABELS.length - 1 ? 'failed' : 'completed'));
      if (selectedTool.name === 'assign_task') {
        setAssignmentDemo((previous) => previous ? { ...previous, status: 'failed', error: result.error as string } : null);
      }
      onExecuteTool(selectedTool.name, parsed.args, durationMs, 'FAILED', result);
    } finally {
      setRunning(false);
    }
  };

  const resetSimulation = () => {
    setSimulation(createInitialSimulationState());
    setStages([]);
    setLatestRun(null);
    setAssignmentDemo(null);
    setFieldErrors({});
    onClearSimulation();
  };

  return (
    <div className="mcp-control-page flex-1 min-h-0 overflow-y-auto bg-[#0b1015] text-slate-200">
      <div className="mcp-control-inner mx-auto flex w-full max-w-[1800px] flex-col gap-5 p-4 md:gap-6 md:p-6">
        <header className="flex flex-col gap-4 border-b border-[#26323a] pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-semibold text-slate-100 md:text-lg">MCP Control Center</h1>
              <span className="inline-flex items-center gap-1.5 border border-amber-800/70 bg-amber-950/40 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-amber-200">
                <ShieldAlert size={13} aria-hidden="true" /> Local simulation only
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-xs leading-5 text-slate-400">Exercise gateway tools against isolated demo state. Simulated runs never call MCP tools or change network state.</p>
          </div>
          <div className={`flex w-fit items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-wide ${connected ? 'border-emerald-900 bg-emerald-950/30 text-emerald-300' : 'border-rose-900 bg-rose-950/30 text-rose-300'}`} role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {loading ? 'Checking gateway' : connected ? 'Gateway connected' : 'Gateway disconnected'}
            <span className="border-l border-current/30 pl-2">{tools.length} tools</span>
          </div>
        </header>

        {!loading && !connected && (
          <div className="flex items-start gap-3 border border-rose-900/70 bg-rose-950/25 p-3 text-xs text-rose-200" role="alert">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div><strong className="font-semibold">Tool definitions unavailable.</strong> {connectionError || 'Reconnect the MCP gateway to load its registered tools.'} Simulation is paused until the live schema can be discovered.</div>
          </div>
        )}

        <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[245px_minmax(360px,1fr)_minmax(300px,0.92fr)]">
          <section className="mcp-panel min-w-0" aria-labelledby="registered-tools-title">
            <div className="mcp-panel-heading">
              <div><Server size={15} aria-hidden="true" /><h2 id="registered-tools-title">Registered tools</h2></div>
              <span>{tools.length}</span>
            </div>
            <div className="mcp-tool-list">
              {loading ? (
                <div className="mcp-empty-state"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /><span>Loading gateway schemas…</span></div>
              ) : tools.length === 0 ? (
                <div className="mcp-empty-state"><CircleHelp size={18} aria-hidden="true" /><span>{connected ? 'The gateway returned no public tools.' : 'No tools available while disconnected.'}</span></div>
              ) : tools.map((tool) => (
                <button key={tool.name} type="button" onClick={() => selectTool(tool)} aria-pressed={selectedName === tool.name} className={`mcp-tool-option ${selectedName === tool.name ? 'is-selected' : ''}`}>
                  <span className="flex min-w-0 items-center justify-between gap-2">
                    <code className="truncate">{tool.name}</code>
                    {selectedName === tool.name && <ChevronRight size={14} className="shrink-0" aria-hidden="true" />}
                  </span>
                  <span className="mcp-tool-description">{tool.description || 'No description provided by the gateway.'}</span>
                </button>
              ))}
            </div>
            <div className="mcp-panel-footnote"><SlidersHorizontal size={13} aria-hidden="true" /> Definitions and fields are discovered from the gateway.</div>
          </section>

          <section className="mcp-panel min-w-0" aria-labelledby="tool-config-title">
            {selectedTool ? <>
              <div className="mcp-panel-heading">
                <div><Code2 size={15} aria-hidden="true" /><h2 id="tool-config-title">Configure simulation</h2></div>
                <button type="button" className="mcp-icon-button" onClick={loadExample} title="Load example arguments" aria-label="Load example arguments"><RotateCcw size={14} /></button>
              </div>
              <form className="mcp-config-form" onSubmit={runSimulation} noValidate>
                <div className="mcp-selected-tool">
                  <code>{selectedTool.name}</code>
                  <p>{selectedTool.description || 'No description provided by the gateway.'}</p>
                </div>
                <div className="mcp-field-list">
                  {fieldDefinitions.length === 0 ? <p className="mcp-no-arguments">This tool has no input arguments.</p> : fieldDefinitions.map(([name, property]) => {
                    const required = requiredFor(selectedTool).includes(name);
                    const value = values[name] ?? '';
                    const fieldId = `mcp-field-${name}`;
                    const enumValues = Array.isArray(property.enum) ? property.enum : [];
                    return <div className="mcp-field" key={name}>
                      <label htmlFor={fieldId}>{name}{required && <span className="mcp-required">Required</span>}</label>
                      {property.description && <p>{property.description}</p>}
                      {property.type === 'boolean' || enumValues.length > 0 ? (
                        <select id={fieldId} value={value} aria-invalid={Boolean(fieldErrors[name])} onChange={(event) => setValues((previous) => ({ ...previous, [name]: event.target.value }))}>
                          {!required && <option value="">Not specified</option>}
                          {property.type === 'boolean' ? <><option value="true">True</option><option value="false">False</option></> : enumValues.map((option) => <option key={String(option)} value={String(option)}>{String(option)}</option>)}
                        </select>
                      ) : property.type === 'array' || property.type === 'object' ? (
                        <textarea id={fieldId} rows={3} value={value} placeholder={property.type === 'array' ? 'Comma-separated values or JSON array' : '{ "key": "value" }'} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] ? `${fieldId}-error` : undefined} onChange={(event) => setValues((previous) => ({ ...previous, [name]: event.target.value }))} />
                      ) : (
                        <input id={fieldId} type={property.type === 'number' || property.type === 'integer' ? 'number' : 'text'} step={property.type === 'integer' ? '1' : property.type === 'number' ? 'any' : undefined} value={value} aria-invalid={Boolean(fieldErrors[name])} aria-describedby={fieldErrors[name] ? `${fieldId}-error` : undefined} onChange={(event) => setValues((previous) => ({ ...previous, [name]: event.target.value }))} />
                      )}
                      {fieldErrors[name] && <span id={`${fieldId}-error`} className="mcp-field-error" role="alert">{fieldErrors[name]}</span>}
                    </div>;
                  })}
                </div>
                <details className="mcp-schema-details">
                  <summary>View input schema</summary>
                  <pre>{JSON.stringify(selectedTool.inputSchema ?? { type: 'object', properties: {} }, null, 2)}</pre>
                </details>
                <div className="mcp-form-actions">
                  <button type="submit" className="mcp-run-button" disabled={running || loading || !connected}>
                    {running ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                    {running ? 'Simulating…' : 'Run simulation'}
                  </button>
                  <span>Local demo state only</span>
                </div>
              </form>

              <div className="mcp-execution" aria-live="polite">
                <div className="mcp-subheading"><h3>Execution trace</h3>{latestRun && <span><Clock3 size={12} /> {latestRun.durationMs} ms</span>}</div>
                {stages.length === 0 ? <div className="mcp-empty-state compact"><Play size={15} aria-hidden="true" /><span>Run a tool simulation to see the execution trace.</span></div> : <ol className={`mcp-stage-list ${selectedTool?.name === 'assign_task' ? 'assignment-stages' : ''}`}>
                  {runStageLabels.map((label, index) => <li key={label} className={`mcp-stage ${stages[index]}`}>
                    <span className="mcp-stage-marker">{stages[index] === 'completed' ? <Check size={12} /> : stages[index] === 'failed' ? <XCircle size={13} /> : stages[index] === 'active' ? <LoaderCircle size={12} className="animate-spin" /> : index + 1}</span>
                    <span>{label}</span>
                  </li>)}
                </ol>}
                {latestRun && <>
                  <div className="mcp-request-preview"><strong>Request arguments</strong><pre>{JSON.stringify(latestRun.args, null, 2)}</pre></div>
                  <div className={`mcp-result-preview ${latestRun.status === 'FAILED' ? 'is-failed' : ''}`}>
                    <div><strong>{latestRun.status === 'FAILED' ? 'Simulation error' : 'Simulated result'}</strong><span>{latestRun.time}</span></div>
                    <pre>{JSON.stringify(latestRun.result, null, 2)}</pre>
                  </div>
                </>}
              </div>
              {assignmentDemo && <AssignmentSimulationView demo={assignmentDemo} />}
            </> : <div className="mcp-select-empty"><Search size={22} aria-hidden="true" /><h2 id="tool-config-title">Select a gateway tool</h2><p>Choose a discovered MCP tool to inspect its schema and run it against isolated simulation data.</p></div>}
          </section>

          <aside className="mcp-panel min-w-0" aria-labelledby="simulation-history-title">
            <div className="mcp-panel-heading">
              <div><Clock3 size={15} aria-hidden="true" /><h2 id="simulation-history-title">Run history</h2></div>
              <button type="button" className="mcp-clear-button" onClick={resetSimulation} disabled={!visibleLogs.some((log) => log.mode === 'SIMULATION') && !latestRun} title="Reset local simulation and clear simulation logs">
                <RotateCcw size={13} aria-hidden="true" /> Reset
              </button>
            </div>
            <div className="mcp-history-list">
              {visibleLogs.length === 0 ? <div className="mcp-empty-state"><CheckCircle2 size={18} aria-hidden="true" /><span>No runs recorded. Simulated and live/chat calls for discovered tools will appear here.</span></div> : visibleLogs.map((log) => <article className="mcp-history-item" key={log.id}>
                <div className="mcp-history-topline">
                  <code>{log.toolName}</code>
                  <span className={`mcp-status-pill ${log.status === 'FAILED' ? 'failed' : log.status === 'RUNNING' ? 'running' : 'success'}`}>{log.status}</span>
                </div>
                <div className="mcp-history-meta"><span className={`mcp-mode-tag ${log.mode === 'SIMULATION' ? 'simulation' : ''}`}>{log.mode === 'SIMULATION' ? 'SIMULATION' : 'LIVE / CHAT'}</span><span>{log.timestamp}</span><span>{log.executionTimeMs} ms</span></div>
                <details className="mcp-history-details"><summary>Inspect request and result</summary><strong>Request</strong><pre>{JSON.stringify(log.arguments, null, 2)}</pre><strong>Result</strong><pre>{JSON.stringify(log.result ?? null, null, 2)}</pre></details>
              </article>)}</div>
            <div className="mcp-panel-footnote"><ShieldAlert size={13} aria-hidden="true" /> Reset clears only local simulation records and demo state.</div>
          </aside>
        </div>
      </div>
    </div>
  );
};