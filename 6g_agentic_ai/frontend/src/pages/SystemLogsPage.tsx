import React, { useState } from 'react';
import { FactoryEvent } from '../types/factory';
import { FileText, Search, Filter, CheckCircle2, AlertTriangle, Terminal, ShieldCheck } from 'lucide-react';

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
    <div className="flex-1 p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200 select-none font-mono">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              SYSTEM & AGENT EVENT LOGS
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
              {filtered.length} LOG RECORDS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail for agent communications, MCP function calls, OAuth token events, and robot movements
          </p>
        </div>

        {/* Filter Input */}
        <div className="relative flex items-center w-72">
          <Search className="w-4 h-4 absolute left-3 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Search log activity..."
            className="w-full bg-slate-900 border border-slate-800 text-xs pl-9 pr-3 py-1.5 rounded-xl focus:border-sky-500 outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden text-xs">
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
                <span className="text-slate-300 font-semibold">{evt.source}</span>
                <span className="col-span-2 text-slate-200">{evt.action}</span>
                <span className="text-emerald-400 font-bold">✓ {evt.status.toUpperCase()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
