import React, { useState } from 'react';
import { FactoryEvent } from '../types/factory';
import { Search } from 'lucide-react';
import { redactSensitiveText } from '../services/redaction';

interface SystemLogsPageProps {
  events: FactoryEvent[];
}

export const SystemLogsPage: React.FC<SystemLogsPageProps> = ({ events }) => {
  const [filterText, setFilterText] = useState('');

  const filtered = events.filter(
    (e) =>
      e.action.toLowerCase().includes(filterText.toLowerCase()) ||
      e.source.toLowerCase().includes(filterText.toLowerCase()) ||
      e.eventType.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <main className="flex-1 p-4 md:p-6 bg-[#080b12] overflow-y-auto space-y-5 md:space-y-6 text-slate-200 font-mono">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">
              SESSION ACTIVITY
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
              {filtered.length} SESSION EVENTS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Events recorded by this browser session. This is not a persistent backend audit log.
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative flex w-full items-center md:w-72">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Search session events"
            placeholder="Search log activity..."
            className="min-h-11 w-full bg-slate-900 border border-slate-800 text-xs pl-9 pr-3 py-2 rounded-lg focus:border-sky-500 outline-none"
          />
        </div>
      </header>

      {/* Logs Table */}
      <div className="max-w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 text-xs">
        <div className="min-w-[760px] overflow-hidden">
        <div className="bg-slate-950 p-3 border-b border-slate-800 grid grid-cols-6 text-slate-400 font-bold text-[11px]">
          <span>TIMESTAMP</span>
          <span>EVENT TYPE</span>
          <span>SOURCE AGENT</span>
          <span className="col-span-2">ACTION / DETAILS</span>
          <span>STATUS</span>
        </div>

        <div className="divide-y divide-slate-800 max-h-[550px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 italic">No log entries found.</div>
          ) : (
            filtered.map((evt) => (
              <div key={evt.id} className="p-3 grid grid-cols-6 items-center hover:bg-slate-800/50">
                <span className="text-sky-400">{evt.timestamp}</span>
                <span className="font-bold text-amber-300">{evt.eventType}</span>
                <span className="text-slate-300 font-semibold">{redactSensitiveText(evt.source)}</span>
                <span className="col-span-2 text-slate-200">{redactSensitiveText(evt.action)}</span>
                <span className={`font-bold ${evt.status === 'failed' ? 'text-rose-400' : evt.status === 'processing' ? 'text-amber-300' : evt.status === 'info' ? 'text-slate-400' : 'text-emerald-400'}`}>
                  {evt.status === 'success' ? '✓ ' : evt.status === 'failed' ? '! ' : ''}{evt.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
        </div>
    </main>
  );
};
