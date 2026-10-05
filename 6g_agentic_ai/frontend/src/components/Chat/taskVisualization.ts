import type { Station } from '../../types/factory';

export interface TaskRunLike {
  command: string;
  status: string;
  steps: Array<{
    tool?: string;
    status?: string;
    input?: unknown;
    output?: unknown;
  }>;
}

export type RobotExecutionState =
  | 'awaiting_response'
  | 'awaiting_confirmation'
  | 'accepted'
  | 'queued'
  | 'active'
  | 'moving'
  | 'picking'
  | 'delivering'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'response_received';

export interface RobotRoute {
  source: string;
  destination: string;
}

export interface RobotMilestone {
  label: string;
  state: 'complete' | 'active' | 'pending' | 'failed';
}

function inputOf(run: TaskRunLike) {
  return run.steps.map((step) => step.input).filter((input) => input !== undefined);
}

function outputOf(run: TaskRunLike) {
  return run.steps.map((step) => step.output).filter((output) => output !== undefined);
}

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

function collectNamedValues(value: unknown, names: string[], found: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectNamedValues(entry, names, found));
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    Object.values(record).forEach((entry) => collectNamedValues(entry, names, found));
    names.forEach((name) => {
      if (record[name] !== undefined && record[name] !== null) found.push(record[name]);
    });
  }
  return found;
}

function normalize(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function locationLabel(value: unknown, stations: Station[]): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = typeof value === 'object'
    ? findValue(value, ['name', 'label', 'location', 'station', 'id', 'code'])
    : value;
  if (raw === undefined || raw === null || raw === '') return undefined;
  const normalized = normalize(raw);
  const station = stations.find((entry) =>
    [entry.id, entry.code, entry.name].some((candidate) => normalize(candidate) === normalized),
  );
  return station?.name || String(raw);
}

function mentionedStations(text: string, stations: Station[]) {
  const normalizedText = normalize(text);
  return stations
    .map((station) => {
      const candidates = [station.id, station.code, station.name];
      const match = candidates
        .map((candidate) => ({ candidate, index: normalizedText.indexOf(normalize(candidate)) }))
        .filter(({ index }) => index >= 0)
        .sort((left, right) => left.index - right.index)[0];
      return match ? { name: station.name, index: match.index } : undefined;
    })
    .filter((entry): entry is { name: string; index: number } => Boolean(entry))
    .sort((left, right) => left.index - right.index);
}

export function classifyTaskRun(run: TaskRunLike | null): 'robot' | 'discovery' | 'authentication' | 'service' | 'message' | 'query' | 'generic' {
  const tool = run?.steps.find((step) => step.tool)?.tool?.toLowerCase() || '';
  const text = `${tool} ${run?.command || ''}`.toLowerCase();
  if (/assign_task|dispatch_robot|robot task/.test(text)) return 'robot';
  if (/find_agent|find_robot|list_agents|registry|discover/.test(text)) return 'discovery';
  if (/authenticate|attach_ue|authentication|authenticat/.test(text)) return 'authentication';
  if (/request_ue_service|service_request|qos/.test(text)) return 'service';
  if (/send_ue_message|broadcast_ue_message|peer.message|broadcast/.test(text)) return 'message';
  if (/inbox|session|status|profile/.test(text)) return 'query';
  return 'generic';
}

export function resolveRobotRoute(run: TaskRunLike, stations: Station[]): RobotRoute {
  const details = [...inputOf(run), ...outputOf(run)];
  const taskText = String(findValue(details, ['task', 'task_text', 'description']) || run.command);
  const mentioned = mentionedStations(`${run.command} ${taskText}`, stations);
  const sourceValue = findValue(details, ['source', 'from', 'origin', 'pickup', 'start', 'source_location', 'origin_location', 'pickup_location']);
  const destinationValue = findValue(details, ['target', 'to', 'destination', 'dropoff', 'goal', 'target_location', 'destination_location', 'dropoff_location']);
  const source = locationLabel(sourceValue, stations);
  const destination = locationLabel(destinationValue, stations);
  const directionToStation = /\b(to|deliver|drop off|destination|at)\b/i.test(`${run.command} ${taskText}`);

  return {
    source: source || (mentioned.length > 1 ? mentioned[0].name : directionToStation ? 'Assigned robot' : mentioned[0]?.name) || 'Assigned robot',
    destination: destination || (mentioned.length > 1 ? mentioned[mentioned.length - 1].name : directionToStation ? mentioned[0]?.name : undefined) || 'Location not returned',
  };
}

export function getRobotExecutionState(run: TaskRunLike): RobotExecutionState {
  const rawStatuses = collectNamedValues(outputOf(run), ['robot_status', 'task_status', 'status', 'state'])
    .map((value) => normalize(value).replace(/ /g, '_'));
  const aliases: Record<string, RobotExecutionState> = {
    pending: 'queued',
    queued: 'queued',
    accepted: 'accepted',
    active: 'active',
    in_progress: 'active',
    executing: 'active',
    moving: 'moving',
    picking: 'picking',
    picking_up: 'picking',
    delivering: 'delivering',
    completed: 'completed',
    complete: 'completed',
    done: 'completed',
    failed: 'failed',
    error: 'failed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
  };
  const backendState = rawStatuses.map((status) => aliases[status]).find(Boolean);
  if (backendState) return backendState;
  if (run.status === 'confirmation' || run.status === 'waiting') return 'awaiting_confirmation';
  if (run.status === 'submitted') return 'awaiting_response';
  if (run.status === 'failed') return 'failed';
  if (run.status === 'cancelled') return 'cancelled';
  if (findValue(outputOf(run), ['accepted']) === true || run.status === 'accepted') return 'accepted';
  return 'response_received';
}

export function getRobotMilestones(state: RobotExecutionState): RobotMilestone[] {
  if (state === 'awaiting_response') {
    return [
      { label: 'Request submitted', state: 'active' },
      { label: 'Robot assignment', state: 'pending' },
      { label: 'Execution result', state: 'pending' },
    ];
  }
  if (state === 'awaiting_confirmation') {
    return [
      { label: 'Request submitted', state: 'complete' },
      { label: 'Confirmation required', state: 'active' },
      { label: 'Robot execution', state: 'pending' },
    ];
  }
  if (state === 'failed' || state === 'cancelled') {
    return [
      { label: 'Request submitted', state: 'complete' },
      { label: 'Robot assignment', state: 'complete' },
      { label: state === 'failed' ? 'Execution failed' : 'Execution cancelled', state: 'failed' },
    ];
  }
  if (state === 'completed') {
    return [
      { label: 'Request submitted', state: 'complete' },
      { label: 'Robot assigned', state: 'complete' },
      { label: 'Task completed', state: 'complete' },
    ];
  }
  if (state === 'queued') {
    return [
      { label: 'Request submitted', state: 'complete' },
      { label: 'Robot task queued', state: 'active' },
      { label: 'Robot execution', state: 'pending' },
    ];
  }
  if (state === 'active' || state === 'moving' || state === 'picking' || state === 'delivering') {
    return [
      { label: 'Request submitted', state: 'complete' },
      { label: 'Robot assigned', state: 'complete' },
      { label: state === 'active' ? 'Execution active' : `Robot ${state}`, state: 'active' },
    ];
  }
  return [
    { label: 'Request submitted', state: 'complete' },
    { label: 'Assignment response received', state: 'complete' },
    { label: 'Robot progress not reported', state: 'pending' },
  ];
}
