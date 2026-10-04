import React from 'react';
import { FactoryEvent } from '../../types/factory';
import { Activity, ArrowRight, ShieldCheck, Wrench, CheckCircle2, AlertTriangle, Cpu, Terminal } from 'lucide-react';

interface EventLogPanelProps {
  events: FactoryEvent[];
}

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ events }) => {
  const getEventIcon = (type: string) => {
    if (type.includes('TOOL')) return Terminal;
    if (type.includes('AUTH') || type.includes('SECURITY')) return ShieldCheck;
    if (type.includes('ROBOT') || type.includes('PACKAGE')) return Wrench;
    return Activity;
  };

  return (
    <div className="dashboard-event-panel bg-[#0b0e17] border-l border-slate-800 p-3 w-80 flex flex-col justify-between select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            RECENT ACTIVITY
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
          SESSION LOG
        </span>
      </div>

      {/* Events List Stream */}
      <div className="my-2 flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs max-h-[500px]">
        {events.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs italic">No task events recorded in this session.</div>
        ) : (
          events.map((evt) => {
            const Icon = getEventIcon(evt.eventType);
            const isSuccess = evt.status === 'success';
            const isError = evt.status === 'failed';

            return (
              <div
                key={evt.id}
                className={`event-card p-2.5 rounded-xl border transition-all ${
                  isError
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : evt.eventType.includes('TOOL')
                    ? 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                    : evt.eventType.includes('AUTH')
                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-semibold text-sky-400">{evt.timestamp}</span>
                  <span className="uppercase text-slate-500">{evt.eventType}</span>
                </div>

                <div className="flex items-start space-x-2">
                  <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-80" />
                  <div className="flex-1 leading-tight">
                    <div className="font-bold flex items-center space-x-1">
                      <span>{evt.source}</span>
                      {evt.target && (
                        <>
                          <ArrowRight className="w-3 h-3 text-slate-500 inline" />
                          <span className="text-sky-300">{evt.target}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5 text-slate-300">{evt.action}</p>
                  </div>
                  {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  {isError && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex justify-between items-center">
        <span>EVENTS RECORDED: {events.length}</span>
        <span>RECORDED EVENTS</span>
      </div>
    </div>
  );
};
