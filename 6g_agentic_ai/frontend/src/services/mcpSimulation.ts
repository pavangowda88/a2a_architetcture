import { INITIAL_AGENTS, INITIAL_ROBOTS } from './factoryState';

export interface SimulatedAgent {
  id: string;
  name: string;
  description: string;
  agentType: string;
  skills: string[];
  services: string[];
  endpoint: string;
  imsi?: string;
  imei?: string;
  authenticated: boolean;
}

export interface SimulatedTaskSession {
  session_id: string;
  task_id: string;
  agent_id: string;
  task: string;
  skill?: string;
  status: 'active' | 'queued' | 'accepted' | 'completed' | 'cancelled';
  started_at: string;
}

export interface MCPSimulationState {
  agents: SimulatedAgent[];
  sessions: SimulatedTaskSession[];
  inboxes: Record<string, Array<Record<string, unknown>>>;
  sequence: number;
}

export interface MCPSimulationOutcome {
  result: Record<string, unknown>;
  nextState: MCPSimulationState;
}

const timestamp = () => new Date().toISOString();

export function createInitialSimulationState(): MCPSimulationState {
  const coreAgents: SimulatedAgent[] = INITIAL_AGENTS.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: `${agent.role} agent in the local 6G network simulation.`,
    agentType: agent.role.toLowerCase(),
    skills: [...agent.skills],
    services: [],
    endpoint: `http://localhost:${agent.port}`,
    imsi: agent.imsi,
    authenticated: agent.oauthStatus === 'AUTHORIZED' || agent.oauthStatus === 'AUTHENTICATED',
  }));
  const robotAgents: SimulatedAgent[] = INITIAL_ROBOTS.map((robot) => ({
    id: robot.agentId,
    name: robot.name,
    description: `Industrial robot agent: ${robot.name}`,
    agentType: 'industrial_arm',
    skills: [robot.skill],
    services: ['robotics'],
    endpoint: `http://localhost:${robot.agentId === 'ue_agent_001' ? 8004 : robot.agentId === 'ue_agent_002' ? 8107 : 8108}`,
    imsi: robot.imsi,
    imei: robot.imei,
    authenticated: robot.oauthStatus === 'AUTHENTICATED',
  }));

  return {
    agents: [...coreAgents, ...robotAgents],
    sessions: [
      { session_id: 'SIM-SESSION-0001', task_id: 'SIM-TASK-0001', agent_id: 'ue_agent_001', task: 'Transfer demo package P104', skill: 'pick_and_place', status: 'active', started_at: timestamp() },
      { session_id: 'SIM-SESSION-0002', task_id: 'SIM-TASK-0002', agent_id: 'ue_agent_001', task: 'Stage demo package P105', skill: 'pick_and_place', status: 'queued', started_at: timestamp() },
    ],
    inboxes: {
      ue_agent_001: [{ id: 'SIM-MSG-001', topic: 'task.assignment', content: 'Transfer demo package P104', received_at: timestamp() }],
      ue_agent_002: [{ id: 'SIM-MSG-002', topic: 'network.notice', content: 'Robot agent is ready for a task.', received_at: timestamp() }],
    },
    sequence: 2,
  };
}

function simulated(result: Record<string, unknown>): Record<string, unknown> {
  return { simulation: true, source: 'LOCAL SIMULATION', ...result };
}

function card(agent: SimulatedAgent): Record<string, unknown> {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    url: agent.endpoint,
    skills: agent.skills.map((id) => ({ id, name: id.replace(/_/g, ' '), description: `Robot skill: ${id}`, endpoint: '/task' })),
    services: [...agent.services],
    imsi: agent.imsi,
    imei: agent.imei,
    metadata: { agent_type: agent.agentType, simulation_authenticated: agent.authenticated },
  };
}

function failed(error: string): Record<string, unknown> {
  return simulated({ success: false, error, stage: 'simulation' });
}

export function simulateMCPTool(
  name: string,
  args: Record<string, unknown>,
  state: MCPSimulationState,
): MCPSimulationOutcome {
  const nextState: MCPSimulationState = {
    ...state,
    agents: state.agents.map((agent) => ({ ...agent, skills: [...agent.skills], services: [...agent.services] })),
    sessions: state.sessions.map((session) => ({ ...session })),
    inboxes: { ...state.inboxes },
  };
  const sequence = state.sequence + 1;
  const sessionId = `SIM-SESSION-${String(sequence).padStart(4, '0')}`;
  const taskId = `SIM-TASK-${String(sequence).padStart(4, '0')}`;
  const agentId = String(args.agent_id ?? args.ue_agent_id ?? '');
  let result: Record<string, unknown>;

  switch (name) {
    case 'register': {
      if (nextState.agents.some((agent) => agent.id === agentId)) {
        result = simulated({ success: true, already_registered: true, agent_id: agentId, agent: card(nextState.agents.find((agent) => agent.id === agentId)!), next_action: 'authenticate' });
        break;
      }
      const agent: SimulatedAgent = {
        id: agentId,
        name: String(args.agent_name ?? ''),
        description: `Industrial robot agent: ${String(args.agent_name ?? '')}`,
        agentType: String(args.agent_type ?? 'industrial_arm'),
        skills: Array.isArray(args.skills) ? args.skills.map(String) : [],
        services: Array.isArray(args.services) ? args.services.map(String) : [],
        endpoint: String(args.endpoint ?? ''),
        imsi: String(args.imsi ?? ''),
        imei: String(args.imei ?? ''),
        authenticated: false,
      };
      nextState.agents.push(agent);
      nextState.sequence = sequence;
      result = simulated({ success: true, agent_id: agent.id, agent: card(agent), endpoint: { status: 'simulated', message: 'No process was started.' }, session: { session_id: sessionId, operation: 'register' } });
      break;
    }
    case 'authenticate': {
      const agent = nextState.agents.find((item) => item.id === agentId);
      if (!agent) {
        result = failed(`Agent '${agentId}' is not present in the simulation registry.`);
        break;
      }
      const lowTrust = args.simulate_low_trust === true;
      agent.authenticated = !lowTrust;
      result = simulated({ success: !lowTrust, agent_id: agent.id, authenticated: !lowTrust, result: { success: !lowTrust, authenticated: !lowTrust, reason: lowTrust ? 'Simulated low-trust challenge was not approved.' : 'Subscriber identity validated in the local simulation.' }, session: { session_id: sessionId, operation: 'authenticate', status: lowTrust ? 'failed' : 'active' } });
      nextState.sequence = sequence;
      break;
    }
    case 'assign_task': {
      const requestedSkill = String(args.skill ?? '');
      const agent = agentId
        ? nextState.agents.find((item) => item.id === agentId && item.agentType === 'industrial_arm')
        : nextState.agents.find((item) => item.agentType === 'industrial_arm' && (!requestedSkill || item.skills.includes(requestedSkill)));
      if (!agent) {
        result = failed(agentId ? `Robot '${agentId}' is not present in the simulation registry.` : `No simulated robot advertises '${requestedSkill || 'a compatible skill'}'.`);
        break;
      }
      const session: SimulatedTaskSession = { session_id: sessionId, task_id: taskId, agent_id: agent.id, task: String(args.task ?? ''), skill: requestedSkill || agent.skills[0], status: 'active', started_at: timestamp() };
      nextState.sessions.push(session);
      nextState.sequence = sequence;
      result = simulated({ success: true, agent_id: agent.id, task: session.task, result: { accepted: true, status: 'accepted', task_id: taskId, session_id: sessionId, skill: session.skill }, session: { session_id: sessionId, operation: 'assign_task' } });
      break;
    }
    case 'end_task_session': {
      const session = nextState.sessions.find((item) => item.session_id === String(args.session_id ?? ''));
      if (!session || !['active', 'queued', 'accepted'].includes(session.status)) {
        result = failed(`Active or queued simulated session '${String(args.session_id ?? '')}' was not found.`);
        break;
      }
      session.status = 'completed';
      const nextQueued = nextState.sessions.find((item) => item.agent_id === session.agent_id && item.status === 'queued');
      if (nextQueued) nextQueued.status = 'active';
      result = simulated({ success: true, agent_id: session.agent_id, ended_session_id: session.session_id, next_task_id: nextQueued?.task_id ?? null });
      nextState.sequence = sequence;
      break;
    }
    case 'end_all_task_sessions': {
      const filterAgent = String(args.agent_id ?? '').trim();
      const candidates = nextState.sessions.filter((session) => ['active', 'queued', 'accepted'].includes(session.status) && (!filterAgent || session.agent_id === filterAgent));
      for (const session of candidates) session.status = session.status === 'active' ? 'completed' : 'cancelled';
      result = simulated({ success: true, ended_count: candidates.length, agent_id: filterAgent || null, sessions: candidates.map(({ session_id, status }) => ({ session_id, status })) });
      nextState.sequence = sequence;
      break;
    }
    case 'find_robot_by_skill': {
      const skill = String(args.skill ?? '');
      const agent = nextState.agents.find((item) => item.agentType === 'industrial_arm' && item.skills.includes(skill));
      result = agent ? simulated({ success: true, agent: card(agent), session: { session_id: sessionId, operation: 'find_robot_by_skill' } }) : failed(`No simulated robot advertises '${skill}'.`);
      nextState.sequence = sequence;
      break;
    }
    case 'list_agents_by_skill': {
      const skill = String(args.skill ?? '');
      const agents = nextState.agents.filter((agent) => agent.skills.includes(skill)).map(card);
      result = simulated({ success: true, skill, agents, count: agents.length, session: { session_id: sessionId, operation: 'list_agents_by_skill' } });
      nextState.sequence = sequence;
      break;
    }
    case 'get_ue_inbox': {
      if (!nextState.agents.some((agent) => agent.id === agentId)) {
        result = failed(`UE agent '${agentId}' is not present in the simulation registry.`);
        break;
      }
      const messages = nextState.inboxes[agentId] ?? [];
      result = simulated({ success: true, agent_id: agentId, messages, count: messages.length });
      nextState.sequence = sequence;
      break;
    }
    case 'find_agent': {
      const agent = nextState.agents.find((item) => item.id === agentId);
      result = agent ? simulated({ success: true, agent: card(agent), session: { session_id: sessionId, operation: 'find_agent' } }) : failed(`Agent '${agentId}' was not found in the simulation registry.`);
      nextState.sequence = sequence;
      break;
    }
    case 'list_active_sessions': {
      const sessions = nextState.sessions.filter((session) => ['active', 'queued', 'accepted'].includes(session.status)).map((session) => ({ agent_id: session.agent_id, session_id: session.session_id, task_id: session.task_id, service: session.skill ?? session.task, status: session.status, started_at: session.started_at }));
      result = simulated({ success: true, sessions, count: sessions.length });
      nextState.sequence = sequence;
      break;
    }
    default:
      result = failed(`No local simulation is implemented for '${name}'.`);
  }

  return { result, nextState };
}