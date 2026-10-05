import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Clock3, LoaderCircle, Plus, RefreshCw, Send, XCircle } from 'lucide-react';
import { assignTask, fetchTasks, ManagedTask } from '../services/api';

type TaskFilter = 'all' | 'pending' | 'accepted' | 'queued' | 'in-progress' | 'completed' | 'failed';

function taskStatus(status?: string): TaskFilter | 'cancelled' {
  const value = (status || 'pending').toLowerCase();
  if (value === 'accepted') return 'accepted';
  if (value === 'queued') return 'queued';
  if (['active', 'running', 'in_progress'].includes(value)) return 'in-progress';
  if (['completed', 'success', 'succeeded'].includes(value)) return 'completed';
  if (['failed', 'error'].includes(value)) return 'failed';
  if (['cancelled', 'canceled'].includes(value)) return 'cancelled';
  return 'pending';
}

function displayStatus(status?: string) {
  const normalized = taskStatus(status);
  if (normalized === 'in-progress') return 'In progress';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(value?: string) {
  if (!value) return 'Just assigned';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const filters: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All tasks' },
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'queued', label: 'Queued' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
];

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<ManagedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [taskText, setTaskText] = useState('');
  const [skill, setSkill] = useState('');
  const [payloadKg, setPayloadKg] = useState('0');

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      setTasks(await fetchTasks());
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load assigned tasks.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const counts = useMemo(() => tasks.reduce((total, task) => {
    total[taskStatus(task.status)] += 1;
    total.all += 1;
    return total;
  }, { all: 0, pending: 0, accepted: 0, queued: 0, 'in-progress': 0, completed: 0, failed: 0, cancelled: 0 }), [tasks]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === 'all' || taskStatus(task.status) === filter),
    [filter, tasks],
  );

  const handleAssign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskText.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      await assignTask(taskText.trim(), skill.trim(), Number(payloadKg) || 0);
      setTaskText('');
      setSkill('');
      setPayloadKg('0');
      setNotice('Task assigned and saved.');
      await refresh(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not assign this task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="tasks-page">
      <header className="tasks-heading">
        <div>
          <p className="tasks-eyebrow">Operations</p>
          <h1>Task management</h1>
          <p className="tasks-intro">Keep every assignment and its latest progress in one place.</p>
        </div>
        <button className="tasks-refresh" type="button" onClick={() => void refresh(true)} disabled={refreshing} aria-label="Refresh tasks" title="Refresh tasks">
          <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
          <span>{refreshing ? 'Updating' : 'Refresh'}</span>
        </button>
      </header>

      <section className="tasks-assignment" aria-labelledby="assign-heading">
        <div className="tasks-assignment-title">
          <span className="tasks-icon-box"><Plus size={18} /></span>
          <div>
            <h2 id="assign-heading">Assign a task</h2>
            <p>A suitable robot is selected automatically when no skill is specified.</p>
          </div>
        </div>
        <form className="tasks-form" onSubmit={handleAssign}>
          <label className="tasks-field tasks-field-description">
            <span>Task description</span>
            <input value={taskText} onChange={(event) => setTaskText(event.target.value)} maxLength={1000} placeholder="e.g. Move package A12 to inspection" required />
          </label>
          <label className="tasks-field">
            <span>Skill <small>Optional</small></span>
            <input value={skill} onChange={(event) => setSkill(event.target.value)} maxLength={120} placeholder="Auto-select" />
          </label>
          <label className="tasks-field tasks-payload-field">
            <span>Payload (kg)</span>
            <input type="number" min="0" step="0.1" value={payloadKg} onChange={(event) => setPayloadKg(event.target.value)} />
          </label>
          <button className="tasks-submit" type="submit" disabled={submitting || !taskText.trim()}>
            {submitting ? <LoaderCircle size={16} className="is-spinning" /> : <Send size={15} />}
            <span>{submitting ? 'Assigning' : 'Assign task'}</span>
          </button>
        </form>
      </section>

      {error && <div className="tasks-message tasks-message-error" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => void refresh()} aria-label="Retry loading tasks">Retry</button></div>}
      {notice && !error && <div className="tasks-message tasks-message-success" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss confirmation"><XCircle size={16} /></button></div>}

      <section className="tasks-list-section" aria-labelledby="task-list-heading">
        <div className="tasks-list-heading">
          <div>
            <h2 id="task-list-heading">Assigned tasks</h2>
            <p>{counts.all} {counts.all === 1 ? 'assignment' : 'assignments'} saved</p>
          </div>
          <div className="tasks-summary" aria-label={`${counts['in-progress']} tasks in progress`}>
            <span className="tasks-summary-dot" />
            {counts['in-progress']} in progress
          </div>
        </div>

        <div className="tasks-filters" role="group" aria-label="Filter tasks">
          {filters.map((item) => (
            <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? 'is-selected' : ''} onClick={() => setFilter(item.id)}>
              {item.label}<span>{counts[item.id]}</span>
            </button>
          ))}
        </div>

        <div className="tasks-list" aria-live="polite" aria-busy={loading || refreshing}>
          {loading ? (
            <div className="tasks-state"><LoaderCircle className="is-spinning" size={22} /><strong>Loading assignments</strong><span>Checking the operations database…</span></div>
          ) : visibleTasks.length === 0 ? (
            <div className="tasks-state"><Check size={22} /><strong>{filter === 'all' ? 'No assigned tasks yet' : `No ${filter.replace('-', ' ')} tasks`}</strong><span>{filter === 'all' ? 'New assignments will appear here and stay available after refresh.' : 'Choose another status filter to see more assignments.'}</span></div>
          ) : visibleTasks.map((task, index) => {
            const status = taskStatus(task.status);
            const taskId = task.task_id || task.session_id || `task-${index}`;
            return (
              <article className="managed-task-row" key={taskId} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                <div className={`managed-task-status status-${status}`} aria-label={`Status: ${displayStatus(task.status)}`}>
                  {status === 'completed' ? <CheckCircle2 size={17} /> : status === 'accepted' ? <Check size={17} /> : status === 'failed' ? <AlertCircle size={17} /> : status === 'cancelled' ? <XCircle size={17} /> : status === 'in-progress' ? <LoaderCircle size={17} /> : <Clock3 size={17} />}
                </div>
                <div className="managed-task-main">
                  <h3>{task.task || 'Assigned task'}</h3>
                  <div className="managed-task-meta">
                    <span>{task.agent_id ? `Robot ${task.agent_id}` : 'Robot assignment'}</span>
                    {task.skill && <span>{task.skill.replace(/_/g, ' ')}</span>}
                    {typeof task.payload_kg === 'number' && task.payload_kg > 0 && <span>{task.payload_kg} kg</span>}
                    {task.task_id && <span className="managed-task-id">ID {task.task_id.slice(0, 8)}</span>}
                  </div>
                  {task.error && <p className="managed-task-error">{task.error}</p>}
                </div>
                <div className={`managed-task-badge status-${status}`}>{displayStatus(task.status)}</div>
                <time className="managed-task-time" dateTime={task.updated_at || task.created_at}>{formatDate(task.updated_at || task.created_at)}</time>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};
