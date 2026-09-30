import React from 'react';
import { PipelineStage } from '../../types/factory';
import { CheckCircle2, Loader2, Circle, XCircle } from 'lucide-react';

interface ExecutionPipelineProps {
  stages: PipelineStage[];
}

export const ExecutionPipeline: React.FC<ExecutionPipelineProps> = ({ stages }) => {
  return (
    <div className="bg-[#0b0e17] border-b border-slate-800 p-2.5 px-4 overflow-x-auto select-none">
      <div className="flex items-center justify-between min-w-[900px] space-x-1">
        {stages.map((stage, idx) => {
          const isDone = stage.status === 'COMPLETED';
          const isProcessing = stage.status === 'PROCESSING';
          const isFailed = stage.status === 'FAILED';

          return (
            <React.Fragment key={stage.id}>
              {/* Stage Chip */}
              <div
                className={`flex-1 flex flex-col p-1.5 px-2 rounded-lg border transition-all ${
                  isDone
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : isProcessing
                    ? 'bg-sky-950/50 border-sky-400 text-sky-200 ring-1 ring-sky-400/40 glow-sky'
                    : isFailed
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between space-x-1">
                  <span className="text-[10px] font-mono font-bold tracking-tight truncate">
                    {stage.label}
                  </span>
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin shrink-0" />}
                  {isFailed && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                  {!isDone && !isProcessing && !isFailed && (
                    <Circle className="w-3 h-3 text-slate-600 shrink-0" />
                  )}
                </div>
                {stage.detail && (
                  <span className="text-[9px] font-mono truncate mt-0.5 opacity-80">
                    {stage.detail}
                  </span>
                )}
              </div>

              {/* Arrow Connector */}
              {idx < stages.length - 1 && (
                <div className="text-slate-700 text-xs px-0.5 select-none font-mono">
                  {isDone ? '➔' : '›'}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
