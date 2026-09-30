import React from 'react';
import { PipelineStage } from '../../types/factory';
import { Check, Loader2, Circle, X } from 'lucide-react';

interface ExecutionPipelineProps {
  stages: PipelineStage[];
}

export const ExecutionPipeline: React.FC<ExecutionPipelineProps> = ({ stages }) => {
  const activeIndex = stages.findIndex((stage) => stage.status === 'PROCESSING');
  const failedIndex = stages.findIndex((stage) => stage.status === 'FAILED');
  const currentIndex = failedIndex >= 0 ? failedIndex : activeIndex >= 0 ? activeIndex : stages.findIndex((stage) => stage.status !== 'COMPLETED');
  const current = currentIndex >= 0 ? stages[currentIndex] : stages[stages.length - 1];
  const completedCount = stages.filter((stage) => stage.status === 'COMPLETED').length;
  const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;
  const isFailed = failedIndex >= 0;
  const isDone = currentIndex < 0 && stages.length > 0;

  return (
    <section className="execution-strip" aria-label="Workflow progress">
      <div className="execution-summary">
        <span className="execution-kicker">WORKFLOW</span>
        <span className={`execution-state ${isFailed ? 'failed' : isDone ? 'complete' : 'running'}`}>
          {isFailed ? 'Needs attention' : isDone ? 'Complete' : activeIndex >= 0 ? 'In progress' : 'Ready'}
        </span>
      </div>
      <div className="execution-current">
        <div className="execution-title-row">
          {isFailed ? <X size={14} /> : isDone ? <Check size={14} /> : activeIndex >= 0 ? <Loader2 size={14} className="animate-spin" /> : <Circle size={12} />}
          <strong>{current?.label || 'Waiting for a command'}</strong>
          <span>{stages.length ? `${Math.max(completedCount, 0)} / ${stages.length} steps` : '0 steps'}</span>
        </div>
        <p>{current?.detail || 'The execution sequence will appear here when a task begins.'}</p>
        <div className="execution-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          {stages.map((stage, index) => (
            <i
              key={stage.id}
              className={stage.status === 'COMPLETED' ? 'done' : stage.status === 'PROCESSING' ? 'active' : stage.status === 'FAILED' ? 'failed' : ''}
              title={stage.label}
              aria-label={stage.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
