import { describe, expect, it } from 'vitest';
import type { Station } from '../src/types/factory';
import { classifyTaskRun, getRobotExecutionState, getRobotMilestones, resolveRobotRoute } from '../src/components/Chat/taskVisualization';
import type { TaskRunLike } from '../src/components/Chat/taskVisualization';

const stations: Station[] = [
  { id: 'raw_material', name: 'Raw Material Storage', code: 'STN-01', icon: 'PackageCheck', status: 'IDLE', capacity: 10, itemCount: 4 },
  { id: 'assembly', name: 'Robotic Assembly Area', code: 'STN-02', icon: 'Wrench', status: 'IDLE', capacity: 5, itemCount: 0 },
  { id: 'inspection', name: '6G Laser Inspection', code: 'STN-03', icon: 'Scan', status: 'IDLE', capacity: 5, itemCount: 0 },
  { id: 'packaging', name: 'Automated Packaging', code: 'STN-04', icon: 'BoxSelect', status: 'IDLE', capacity: 10, itemCount: 0 },
];

function makeRun(overrides: Partial<TaskRunLike> = {}): TaskRunLike {
  return {
    command: 'Move workpiece from assembly to inspection',
    status: 'completed',
    steps: [{ tool: 'assign_task', input: { task: 'Move workpiece from assembly to inspection' }, output: { accepted: true } }],
    ...overrides,
  };
}

describe('task visualization mapping', () => {
  it('classifies robot tool calls and keeps unrelated operations distinct', () => {
    expect(classifyTaskRun(makeRun())).toBe('robot');
    expect(classifyTaskRun(makeRun({ command: 'Authenticate subscriber', steps: [{ tool: 'authenticate_agent' }] }))).toBe('authentication');
  });

  it('classifies requests to show every registered agent as discovery', () => {
    expect(classifyTaskRun(makeRun({
      command: 'Show all registered agents',
      steps: [{ tool: 'list_registered_agents' }],
    }))).toBe('discovery');
  });

  it('uses backend locations and resolves factory station identifiers', () => {
    const assigned = makeRun({
      steps: [{ tool: 'assign_task', input: { locations: { source: 'assembly', destination: 'inspection' } } }],
    });
    expect(resolveRobotRoute(assigned, stations)).toEqual({
      source: 'Robotic Assembly Area',
      destination: '6G Laser Inspection',
    });
  });

  it('derives a schematic route from the request when structured locations are absent', () => {
    expect(resolveRobotRoute(makeRun(), stations)).toEqual({
      source: 'Robotic Assembly Area',
      destination: '6G Laser Inspection',
    });
  });

  it('maps backend task status without treating an accepted response as physical completion', () => {
    const active = makeRun({ steps: [{ tool: 'assign_task', output: { accepted: true, task: { status: 'active' } } }] });
    expect(getRobotExecutionState(active)).toBe('active');
    expect(getRobotMilestones('active')[2]).toEqual({ label: 'Execution active', state: 'active' });

    const responseOnly = makeRun({ steps: [{ tool: 'assign_task', output: { accepted: true, task: { task_id: 'task-1' } } }] });
    expect(getRobotExecutionState(responseOnly)).toBe('accepted');
    expect(getRobotMilestones('accepted')[2]).toEqual({ label: 'Robot progress not reported', state: 'pending' });
  });

  it('prefers nested robot task status over the MCP wrapper status', () => {
    const wrapped = makeRun({
      steps: [{ tool: 'assign_task', output: { status: 'completed', result: { task: { status: 'moving' } } } }],
    });
    expect(getRobotExecutionState(wrapped)).toBe('moving');
  });

  it('represents confirmation and failure separately', () => {
    expect(getRobotExecutionState(makeRun({ status: 'confirmation', steps: [] }))).toBe('awaiting_confirmation');
    expect(getRobotMilestones('failed')[2].state).toBe('failed');
  });
});