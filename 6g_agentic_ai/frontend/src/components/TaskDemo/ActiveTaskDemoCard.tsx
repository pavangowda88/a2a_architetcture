import React from 'react';
import { Bot, Terminal, ArrowRight, Zap, Play, CheckCircle2 } from 'lucide-react';

interface ActiveTaskDemoCardProps {
  taskTitle: string;
  activeRobotId?: string;
  sourceStation?: string;
  targetStation?: string;
  mcpToolName?: string;
  progressPercent: number;
  currentStepDescription: string;
  isExecuting: boolean;
}

export const ActiveTaskDemoCard: React.FC<ActiveTaskDemoCardProps> = ({
  taskTitle,
  activeRobotId = '—',
  sourceStation = '—',
  targetStation = '—',
  mcpToolName = '—',
  progressPercent,
  currentStepDescription,
  isExecuting,
}) => {
  const pct = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="shrink-0 bg-[#0a0c14] border border-slate-800/80 rounded-sm select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-slate-900/30">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isExecuting ? 'bg-sky-400 status-pulse' : pct === 100 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-[9px] font-mono tracking-[0.2em] text-slate-500 uppercase">ACTIVE TASK</span>
          <span className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-wider">{taskTitle}</span>
        </div>
        <span
          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm border ${
            isExecuting
              ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
              : pct === 100
              ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/8'
              : 'text-slate-500 border-slate-700 bg-transparent'
          }`}
        >
          {isExecuting ? '● EXECUTING' : pct === 100 ? '✓ COMPLETE' : '○ STANDBY'}
        </span>
      </div>

      {/* Flow row */}
      <div className="flex items-center gap-0 px-3 py-2">
        {/* Source */}
        <div className="flex flex-col min-w-0">
          <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">SOURCE</span>
          <span className="text-[11px] font-mono font-semibold text-slate-300 truncate">{sourceStation}</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-slate-700 mx-3 shrink-0" />

        {/* Robot + Tool (center) */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-sm bg-slate-900/60 border border-slate-800 shrink-0">
          <Bot className={`w-3.5 h-3.5 shrink-0 ${isExecuting ? 'text-sky-400' : 'text-slate-500'}`} />
          <span className={`text-[11px] font-mono font-bold ${isExecuting ? 'text-sky-300' : 'text-slate-400'}`}>
            {activeRobotId}
          </span>
          <span className="text-slate-700 text-[10px]">·</span>
          <Terminal className="w-3 h-3 text-amber-500/70 shrink-0" />
          <span className="text-[10px] font-mono text-amber-400">{mcpToolName}</span>
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-slate-700 mx-3 shrink-0" />

        {/* Target */}
        <div className="flex flex-col min-w-0">
          <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">TARGET</span>
          <span className="text-[11px] font-mono font-semibold text-slate-300 truncate">{targetStation}</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Description */}
        <div className="hidden lg:block text-[10px] font-mono text-slate-500 italic max-w-[260px] truncate">
          {currentStepDescription}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">PROGRESS</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct === 100 ? 'bg-emerald-400' : 'bg-sky-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-[11px] font-mono font-bold tabular-nums ${pct === 100 ? 'text-emerald-400' : 'text-sky-400'}`}>
                {pct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
