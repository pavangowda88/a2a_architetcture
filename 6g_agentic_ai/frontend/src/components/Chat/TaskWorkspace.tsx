import React, { useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Database,
  FlaskConical,
  MapPin,
  MessageSquare,
  Network,
  Radio,
  Route,
  ShieldCheck,
  Terminal,
  UserRound,
  X,
} from 'lucide-react';
import { CommandToolStep } from './CommandOutputPanel';
import type { Station } from '../../types/factory';
import { classifyTaskRun, getRobotExecutionState, getRobotMilestones, resolveRobotRoute } from './taskVisualization';

export type TaskRunStatus = 'submitted' | 'waiting' | 'confirmation' | 'accepted' | 'completed' | 'failed' | 'cancelled';

export interface TaskRun {
  id: string;
  command: string;
  status: TaskRunStatus;
  reply?: string;
  steps: CommandToolStep[];
  startedAt: string;
  durationMs?: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  runId?: string;
}

interface TaskWorkspaceProps {
  conversation: ConversationMessage[];
  activeRun: TaskRun | null;
  isProcessing: boolean;
  backendConnected: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  stations: Station[];
}

type TaskKind = 'robot' | 'discovery' | 'authentication' | 'service' | 'message' | 'query' | 'generic';

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    /token|secret|password|authorization/i.test(key) ? '[redacted]' : redact(entry),
  ]));
}

const pretty = (value: unknown) => JSON.stringify(redact(value), null, 2);

function findValue(value: unknown, names: string[]): unknown {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findValue(entry, names);
      if (found !== undefined && found !== null && found !== '') return found;
    }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null && record[name] !== '') return record[name];
  }
  for (const entry of Object.values(record)) {
    const found = findValue(entry, names);
    if (found !== undefined && found !== null && found !== '') return found;
  }
  return undefined;
}

function findCollection(value: unknown, names: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  for (const name of names) if (Array.isArray(record[name])) return record[name] as unknown[];
  for (const entry of Object.values(record)) {
    const found = findCollection(entry, names);
    if (found.length) return found;
  }
  return [];
}

function taskLabel(kind: TaskKind) {
  return ({
    robot: 'Robot task assignment',
    discovery: 'Agent discovery',
    authentication: 'UE authentication',
    service: 'Network service request',
    message: 'A2A message',
    query: 'Network query',
    generic: 'Task response',
  })[kind];
}

function outputOf(run: TaskRun) {
  return run.steps.map((step) => step.output).filter((output) => output !== undefined);
}

function inputOf(run: TaskRun) {
  return run.steps.map((step) => step.input).filter((input) => input !== undefined);
}

function responseStatus(run: TaskRun | null, isProcessing: boolean): TaskRunStatus | 'idle' {
  if (!run) return isProcessing ? 'submitted' : 'idle';
  return run.status;
}

function statusLabel(status: TaskRunStatus | 'idle') {
  return ({
    idle: 'Ready',
    submitted: 'Waiting for MCP response',
    waiting: 'Waiting for your input',
    confirmation: 'Confirmation required',
    accepted: 'Accepted by backend',
    completed: 'Response received',
    failed: 'Request failed',
    cancelled: 'Cancelled',
  })[status];
}

function StatusIcon({ status }: { status: TaskRunStatus | 'idle' }) {
  if (status === 'failed') return <AlertTriangle size={14} aria-hidden="true" />;
  if (status === 'completed' || status === 'accepted') return <CheckCircle2 size={14} aria-hidden="true" />;
  if (status === 'cancelled') return <X size={14} aria-hidden="true" />;
  if (status === 'idle') return <CircleHelp size={14} aria-hidden="true" />;
  return <Activity size={14} aria-hidden="true" />;
}

function StageRail({ status }: { status: TaskRunStatus | 'idle' }) {
  const stages = [
    { label: 'Submitted', done: status !== 'idle', active: status === 'submitted' },
    { label: status === 'waiting' ? 'Input needed' : status === 'confirmation' ? 'Confirm action' : 'MCP response', done: ['waiting', 'confirmation', 'accepted', 'completed', 'failed', 'cancelled'].includes(status), active: ['submitted', 'waiting', 'confirmation'].includes(status) },
    { label: status === 'accepted' ? 'Accepted' : status === 'failed' ? 'Failed' : status === 'cancelled' ? 'Cancelled' : 'Result', done: ['accepted', 'completed', 'failed', 'cancelled'].includes(status), active: false },
  ];
  return (
    <ol className="task-stage-rail" aria-label="Request lifecycle">
      {stages.map((stage, index) => (
        <li className={`${stage.done ? 'is-done' : ''} ${stage.active ? 'is-active' : ''}`} key={stage.label}>
          <span className="task-stage-marker">{stage.done ? <Check size={12} /> : index + 1}</span>
          <span>{stage.label}</span>
        </li>
      ))}
    </ol>
  );
}

function FieldList({ entries }: { entries: Array<[string, unknown]> }) {
  const visible = entries.filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!visible.length) return <p className="task-empty-note">No additional details were returned.</p>;
  return (
    <dl className="task-field-list">
      {visible.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{typeof value === 'object' ? pretty(value) : String(value)}</dd></div>
      ))}
    </dl>
  );
}

function TaskFlow({ run, kind }: { run: TaskRun; kind: TaskKind }) {
  const inputs = inputOf(run);
  const outputs = outputOf(run);
  const agent = findValue(inputs, ['agent_id', 'robot_id', 'ue_agent_id', 'sender_id', 'agentId']);
  const recipient = findValue(inputs, ['recipient_id', 'recipient', 'target_agent_id']);
  const skill = findValue(inputs, ['skill', 'skill_id']);
  const service = findValue(inputs, ['service_type', 'service']);
  const target = findValue(inputs, ['target', 'to', 'destination', 'target_location']);
  const imsi = findValue(inputs, ['imsi']);
  const tool = run.steps.find((step) => step.tool)?.tool;
  const resultCount = findValue(outputs, ['count']);
  const flow = {
    robot: ['Factory request', `Assign ${String(agent || 'best-fit robot')}`, target ? `Destination: ${String(target)}` : 'Assignment result'],
    discovery: [`Find ${String(skill || 'an agent')}`, 'Search agent registry', resultCount !== undefined ? `${String(resultCount)} ${resultCount === 1 ? 'match' : 'matches'}` : 'Matching agents'],
    authentication: [`UE ${String(imsi || 'identity')}`, 'Authenticate via AUSF / UDM', 'Access decision'],
    service: [String(agent || 'UE'), `Request ${String(service || 'network service')}`, 'QoS result'],
    message: [String(agent || 'Message sender'), 'A2A message delivery', `Recipient: ${String(recipient || 'target agent')}`],
    query: [`Query ${String(agent || 'network')}`, tool || 'Read network data', 'Query response'],
    generic: ['Operations request', tool || 'Process task', 'Assistant response'],
  }[kind];
  const isTerminal = ['accepted', 'completed', 'failed', 'cancelled'].includes(run.status);
  const hasFailed = run.status === 'failed' || run.status === 'cancelled';
  const activeStep = run.status === 'submitted' || run.status === 'waiting' || run.status === 'confirmation' ? 1 : 2;

  return (
    <div className="task-flow-visual">
      <div className="task-flow-heading">
        <div><span className="task-section-label">REQUEST FLOW</span><strong>{taskLabel(kind)}</strong></div>
        <span>Backend-reported progress only</span>
      </div>
      <ol className="task-flow-steps" aria-label="Task request flow">
        {flow.map((label, index) => {
          const complete = (!hasFailed && isTerminal) || index < activeStep;
          const active = !isTerminal && index === activeStep;
          const failed = hasFailed && index === 2;
          return (
            <React.Fragment key={`${index}-${label}`}>
              <li className={`${complete ? 'is-done' : ''} ${active ? 'is-active' : ''} ${failed ? 'is-failed' : ''}`}>
                <span className="task-flow-marker">{complete ? <Check size={12} /> : failed ? <X size={12} /> : index + 1}</span>
                <span className="task-flow-step-name">{['Request', 'MCP action', 'Outcome'][index]}</span>
                <strong>{label}</strong>
              </li>
              {index < flow.length - 1 && <ArrowRight className="task-flow-arrow" size={15} aria-hidden="true" />}
            </React.Fragment>
          );
        })}
      </ol>
    </div>
  );
}

function TaskDiagram({ run, kind, stations }: { run: TaskRun; kind: TaskKind; stations: Station[] }) {
  const inputs = inputOf(run);
  const outputs = outputOf(run);
  const details = [...inputs, ...outputs];
  const agentId = findValue(details, ['agent_id', 'robot_id', 'ue_agent_id', 'sender_id', 'agentId']);
  const recipient = findValue(details, ['recipient_id', 'recipient', 'target_agent_id']);
  const skill = findValue(details, ['skill', 'skill_id']);
  const agents = findCollection(outputs, ['agents', 'matches', 'items']);
  const singleAgent = findValue(outputs, ['agent']);
  const cards = agents.length ? agents : singleAgent && typeof singleAgent === 'object' ? [singleAgent] : [];
  const isBusy = run.status === 'submitted';

  if (kind === 'robot') {
    const payload = findValue(details, ['payload_kg']);
    const route = resolveRobotRoute(run, stations);
    const taskResult = findValue(outputs, ['task']);
    const taskId = findValue([taskResult, ...outputs], ['task_id', 'session_id']);
    const executionState = getRobotExecutionState(run);
    const milestones = getRobotMilestones(executionState);
    const assignedRobot = findValue(details, ['agent_id', 'robot_id', 'robot_name', 'agentId']);
    const taskDescription = findValue(details, ['task', 'task_text', 'description']) || run.command;
    const previewMoves = ['accepted', 'queued', 'active', 'moving', 'picking', 'delivering'].includes(executionState);
    const stateLabel = executionState.replace(/_/g, ' ');
    const actionLabel = ({
      awaiting_response: 'Waiting for task assignment',
      awaiting_confirmation: 'Task requires operator confirmation',
      accepted: 'Robot task accepted · previewing planned route',
      queued: `Task queued · previewing: ${String(taskDescription)}`,
      active: 'Executing assigned task',
      moving: `Moving toward ${route.destination}`,
      picking: `Picking up at ${route.source}`,
      delivering: `Delivering to ${route.destination}`,
      completed: 'Task marked complete by backend',
      failed: 'Task failed',
      cancelled: 'Task cancelled',
      response_received: 'Assignment response received · execution not reported',
    } as const)[executionState];
    return (
      <>
        <div className="robot-mission-heading">
          <div className="task-visual-title"><Bot size={17} /><div><strong>Robot mission</strong><span>{skill ? `Capability: ${String(skill)}` : 'Robot assignment and route'}</span></div></div>
          <span className={`robot-execution-chip state-${executionState}`}><i />{stateLabel}</span>
        </div>
        <div className="robot-mission-summary">
          <div><span>ASSIGNED ROBOT</span><strong>{String(assignedRobot || agentId || 'Awaiting backend assignment')}</strong></div>
          <div><span>MISSION</span><strong>{String(taskDescription)}</strong></div>
        </div>
        <div className="robot-action-banner"><Activity size={15} /><div><span>ROBOT ACTION</span><strong>{actionLabel}</strong></div></div>
        <section className={`robot-route-preview ${previewMoves ? 'is-moving' : ''}`} aria-label="Schematic robot route preview">
          <div className="robot-route-preview-heading"><div><Route size={14} /><strong>Route preview</strong></div><span>SCHEMATIC</span></div>
          <div className="robot-route-map">
            <div className="robot-route-stop"><MapPin size={15} /><span>ORIGIN</span><strong>{route.source}</strong></div>
            <div className="robot-route-track" aria-hidden="true">
              <span className="robot-route-line" />
              <span className="robot-route-marker">
                <span className="robot-illustration"><Bot size={30} strokeWidth={1.8} /></span>
                <span className="robot-unit-label">{String(assignedRobot || agentId || 'ROBOT')}</span>
              </span>
            </div>
            <div className="robot-route-stop is-destination"><MapPin size={15} /><span>DESTINATION</span><strong>{route.destination}</strong></div>
          </div>
          <div className="robot-preview-disclaimer"><FlaskConical size={13} /><span>SIMULATED ROUTE PREVIEW · NOT LIVE ROBOT TELEMETRY</span></div>
        </section>
        <ol className="robot-milestones" aria-label="Robot task milestones">
          {milestones.map((milestone, index) => <li className={`is-${milestone.state}`} key={`${milestone.label}-${index}`}>
            <span>{milestone.state === 'complete' ? <Check size={12} /> : milestone.state === 'failed' ? <X size={12} /> : index + 1}</span>
            <strong>{milestone.label}</strong>
          </li>)}
        </ol>
        <p className="robot-telemetry-note">
          {executionState !== 'response_received' && executionState !== 'awaiting_response' && executionState !== 'awaiting_confirmation'
            ? `Backend task status: ${stateLabel}. Live robot position updates are not available.`
            : isBusy
              ? 'Waiting for the backend assignment response. No robot movement is being assumed.'
              : 'The backend returned no movement telemetry. The route above is a visual preview, not a report of physical movement.'}
        </p>
        <FieldList entries={[
          ['Payload', payload !== undefined ? `${String(payload)} kg` : undefined],
          ['Locations', findValue(details, ['locations'])], ['Backend task status', executionState], ['Task / session ID', taskId],
        ]} />
      </>
    );
  }

  if (kind === 'discovery') {
    return (
      <>
        <div className="task-visual-title"><Network size={17} /><div><strong>Registry results</strong><span>{skill ? `Skill query: ${String(skill)}` : 'Matching agents returned by MCP'}</span></div></div>
        {cards.length ? <div className="agent-result-list">{cards.map((agent, index) => {
          const id = findValue(agent, ['id', 'agent_id']);
          const name = findValue(agent, ['name', 'agent_name']);
          const endpoint = findValue(agent, ['url', 'endpoint']);
          const skills = findValue(agent, ['skills']);
          return <article className="agent-result" key={String(id || index)}><div className="agent-result-icon"><Bot size={16} /></div><div><strong>{String(name || id || `Agent ${index + 1}`)}</strong><span>{id && name ? String(id) : 'Agent identity'}</span><small>{endpoint ? String(endpoint) : 'Endpoint not returned'}</small>{skills !== undefined && <small>Skills: {Array.isArray(skills) ? skills.map((entry) => typeof entry === 'object' && entry ? String((entry as Record<string, unknown>).id || '') : String(entry)).filter(Boolean).join(', ') : String(skills)}</small>}</div></article>;
        })}</div> : <p className="task-empty-note">{findValue(outputs, ['count']) === 0 ? 'No matching agents were returned.' : 'The response did not include agent cards.'}</p>}
      </>
    );
  }

  if (kind === 'authentication') {
    const fields = ['authenticated', 'authentication_method', 'imsi', 'trust_score', 'risk_level', 'qos_class', 'service_plan', 'automated_recovery'];
    const labels = ['Authentication', 'Method', 'IMSI', 'Trust score', 'Risk level', 'QoS class', 'Service plan', 'Recovery'];
    const nodes = ['AUSF', 'UDM', 'Security', 'Subscriber'];
    return (
      <>
        <div className="task-visual-title"><ShieldCheck size={17} /><div><strong>UE authentication result</strong><span>Orchestration path defined by the backend</span></div></div>
        <div className="service-route">{nodes.map((node, index) => <React.Fragment key={node}><span className="route-node">{node}</span>{index < nodes.length - 1 && <ArrowRight size={14} />}</React.Fragment>)}</div>
        <FieldList entries={fields.map((field, index) => [labels[index], findValue(outputs, [field])] as [string, unknown])} />
      </>
    );
  }

  if (kind === 'service') {
    const service = findValue(details, ['service_type', 'service']);
    return (
      <>
        <div className="task-visual-title"><Radio size={17} /><div><strong>Service request</strong><span>UE-to-core service negotiation</span></div></div>
        <div className="service-route"><span className="route-node">{String(agentId || 'UE')}</span><ArrowRight size={14} /><span className="route-node">6G CORE</span><ArrowRight size={14} /><span className="route-node">{String(service || 'SERVICE')}</span></div>
        <FieldList entries={[
          ['IMSI', findValue(details, ['imsi'])], ['Service', service],
          ['QoS class', findValue(outputs, ['qos_class'])], ['Service plan', findValue(outputs, ['service_plan'])],
          ['Result status', findValue(outputs, ['status'])],
        ]} />
      </>
    );
  }

  if (kind === 'message') {
    const topic = findValue(details, ['topic']);
    const message = findValue(details, ['content', 'message']);
    return (
      <>
        <div className="task-visual-title"><MessageSquare size={17} /><div><strong>A2A message delivery</strong><span>Delivery state is based on the tool result</span></div></div>
        <div className="message-route"><div><UserRound size={17} /><span>{String(agentId || 'Sender')}</span></div><ArrowRight size={18} /><div><UserRound size={17} /><span>{String(recipient || 'Recipients')}</span></div></div>
        <FieldList entries={[
          ['Topic', topic], ['Content', message], ['Delivery result', findValue(outputs, ['success', 'delivered', 'status'])],
          ['Recipients', findValue(outputs, ['recipients', 'delivered_to'])],
        ]} />
      </>
    );
  }

  if (kind === 'query') {
    return (
      <>
        <div className="task-visual-title"><Database size={17} /><div><strong>Query result</strong><span>Returned data, without simulated activity</span></div></div>
        <FieldList entries={[
          ['Target', agentId], ['Skill', skill], ['Result count', findValue(outputs, ['count'])],
          ['Status', findValue(outputs, ['status'])],
        ]} />
      </>
    );
  }

  return (
    <>
      <div className="task-visual-title"><Terminal size={17} /><div><strong>Tool response</strong><span>{run.steps.find((step) => step.tool)?.tool || 'No MCP tool call was returned'}</span></div></div>
      <p className="task-empty-note">This request did not match a specialized visualization. The actual assistant response and tool data are shown below.</p>
    </>
  );
}

function ToolSteps({ steps }: { steps: CommandToolStep[] }) {
  if (!steps.length) return null;
  return (
    <details className="task-tool-details" open={steps.some((step) => String(step.status || '').toLowerCase() === 'confirmation')}>
      <summary><Terminal size={14} /><span>Tool execution</span><span>{steps.length} step{steps.length === 1 ? '' : 's'}</span></summary>
      <div className="task-tool-list">{steps.map((step, index) => (
        <article className="task-tool-step" key={`${step.tool || 'tool'}-${index}`}>
          <div className="task-tool-heading"><strong>{step.tool || 'MCP tool'}</strong><span>{step.status || 'unknown'}{step.duration_ms !== undefined ? ` · ${step.duration_ms} ms` : ''}</span></div>
          {step.error && <p className="task-error-text">{step.error}</p>}
          {step.input !== undefined && <details open={String(step.status || '').toLowerCase() === 'confirmation'}><summary>Arguments</summary><pre>{pretty(step.input)}</pre></details>}
          {step.output !== undefined && <details><summary>Result</summary><pre>{pretty(step.output)}</pre></details>}
        </article>
      ))}</div>
    </details>
  );
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({
  conversation,
  activeRun,
  isProcessing,
  backendConnected,
  onConfirm,
  onCancel,
  stations,
}) => {
  const conversationEnd = useRef<HTMLDivElement>(null);
  const kind = classifyTaskRun(activeRun);
  const status = responseStatus(activeRun, isProcessing);
  const hasConfirmation = activeRun?.status === 'confirmation';

  useEffect(() => {
    const conversationScroll = conversationEnd.current?.parentElement;
    if (conversationScroll) conversationScroll.scrollTop = conversationScroll.scrollHeight;
  }, [conversation.length, isProcessing]);

  return (
    <div className="task-chat-workspace">
      <section className="conversation-panel" aria-label="Chat conversation">
        <header className="workspace-panel-header">
          <div><MessageSquare size={16} /><h2>Operations chat</h2></div>
          <span className={`connection-tag ${backendConnected ? 'is-connected' : 'is-offline'}`}><i />{backendConnected ? 'MCP connected' : 'Backend unavailable'}</span>
        </header>
        <div className="conversation-scroll" aria-live="polite" aria-relevant="additions text">
          {conversation.length === 0 ? <div className="conversation-empty"><div className="conversation-empty-icon"><MessageSquare size={19} /></div><strong>What should the network do?</strong><p>Ask about agent discovery, UE authentication, service requests, messages, or robot task assignment.</p></div> : conversation.map((message) => (
            <article className={`chat-message ${message.role}`} key={message.id}>
              <div className="chat-message-icon">{message.role === 'user' ? <UserRound size={14} /> : <Bot size={14} />}</div>
              <div className="chat-message-content"><span className="chat-message-role">{message.role === 'user' ? 'You' : '6G assistant'}</span><p>{message.content}</p></div>
            </article>
          ))}
          {isProcessing && <div className="chat-waiting"><span className="chat-pulse" /><span>Request sent · waiting for MCP response</span></div>}
          <div ref={conversationEnd} />
        </div>
        {hasConfirmation && <div className="confirmation-box" role="group" aria-label="Confirm network operation"><p><AlertTriangle size={14} /> This action can modify network state. Review the tool arguments above before proceeding.</p><div><button type="button" className="confirm-action" onClick={onConfirm} disabled={isProcessing}><Check size={14} /> Confirm</button><button type="button" className="cancel-action" onClick={onCancel} disabled={isProcessing}><X size={14} /> Cancel</button></div></div>}
      </section>

      <section className="task-detail-panel" aria-label="Task visualization">
        <header className="workspace-panel-header task-panel-header">
          <div><Activity size={16} /><h2>Task workspace</h2></div>
          <span className={`task-status-chip status-${status}`}><StatusIcon status={status} />{statusLabel(status)}</span>
        </header>
        {activeRun ? <div className="task-detail-scroll">
          <div className="task-request-summary"><span className="task-section-label">CURRENT REQUEST</span><p>{activeRun.command}</p><div className="task-request-meta"><span>{taskLabel(kind)}</span><span>{activeRun.startedAt}</span>{activeRun.durationMs !== undefined && <span>{activeRun.durationMs} ms</span>}</div></div>
          <TaskFlow run={activeRun} kind={kind} />
          <StageRail status={status} />
          <div className="task-visualization"><TaskDiagram run={activeRun} kind={kind} stations={stations} /></div>
          {activeRun.status === 'failed' && activeRun.steps.some((step) => step.error || findValue(step.output, ['error'])) && <div className="task-failure-callout"><AlertTriangle size={14} /><p>{String(activeRun.steps.find((step) => step.error)?.error || findValue(activeRun.steps.map((step) => step.output), ['error']))}</p></div>}
          {activeRun.reply && <div className="task-reply"><span className="task-section-label">ASSISTANT RESPONSE</span><p>{activeRun.reply}</p></div>}
          <ToolSteps steps={activeRun.steps} />
          {activeRun.status === 'submitted' && <div className="task-pending-state"><Clock3 size={16} /><div><strong>Waiting for backend response</strong><span>No agent progress or physical movement is being assumed.</span></div></div>}
        </div> : <div className="task-idle-state"><div className="task-idle-icon"><Activity size={20} /></div><strong>Task activity will appear here</strong><p>Submit a chat request to see its actual MCP tool, arguments, result, and task-specific view.</p><div className="idle-capabilities"><span><Network size={13} /> Agent discovery</span><span><ShieldCheck size={13} /> UE authentication</span><span><Bot size={13} /> Robot assignment</span><span><MessageSquare size={13} /> A2A messaging</span></div></div>}
        <footer className="task-data-footer"><span className={backendConnected ? 'data-live' : 'data-offline'}><i />{backendConnected ? 'Live backend connection' : 'Backend connection unavailable'}</span><span>Progress shown only when returned</span></footer>
      </section>
    </div>
  );
};