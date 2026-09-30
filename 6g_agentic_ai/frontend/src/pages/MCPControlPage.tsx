import React, { useState } from 'react';
import { AVAILABLE_MCP_TOOLS } from '../services/factoryState';
import { MCPToolCallLog } from '../types/factory';
import { Terminal, CheckCircle2, Cpu, Play, Clock, Code, ArrowRight } from 'lucide-react';

interface MCPControlPageProps {
  logs: MCPToolCallLog[];
  onExecuteTool: (toolName: string, args: Record<string, any>) => void;
}

export const MCPControlPage: React.FC<MCPControlPageProps> = ({ logs, onExecuteTool }) => {
  const [selectedTool, setSelectedTool] = useState(AVAILABLE_MCP_TOOLS[0]);

  return (
    <div className="flex-1 p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-wider">
              MCP CONTROL CENTER (FASTMCP GATEWAY)
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
              STREAMABLE HTTP :8010/mcp
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Model Context Protocol Gateway enabling LLM function calling and industrial robot dispatch
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-slate-300 font-bold">MCP SERVER: CONNECTED</span>
        </div>
      </div>

      {/* Execution Sequence Animation Banner */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-2">
        <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider block">
          MCP TOOL EXECUTION PIPELINE ARCHITECTURE
        </span>
        <div className="flex items-center justify-between text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800/80 overflow-x-auto">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-2 py-1 rounded bg-slate-800 text-sky-400 font-bold">LLM REQUEST</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-2 py-1 rounded bg-sky-950 text-sky-300 font-bold border border-sky-500/30">SUPERVISOR AGENT</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-2 py-1 rounded bg-amber-950 text-amber-300 font-bold border border-amber-500/30">MCP SERVER GATEWAY</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-2 py-1 rounded bg-purple-950 text-purple-300 font-bold border border-purple-500/30">TOOL EXECUTION</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">ROBOT ACTION</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Tools List & Tool Call Logs */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Registered MCP Tools */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            REGISTERED MCP TOOLS ({AVAILABLE_MCP_TOOLS.length})
          </h3>
          <div className="space-y-2">
            {AVAILABLE_MCP_TOOLS.map((tool) => {
              const isSelected = selectedTool.name === tool.name;
              return (
                <div
                  key={tool.name}
                  onClick={() => setSelectedTool(tool)}
                  className={`cursor-pointer p-3 rounded-xl border transition-all text-xs font-mono ${
                    isSelected
                      ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 shadow-md shadow-sky-500/10'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold font-mono text-sky-400">{tool.name}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">{tool.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Middle & Right Column: Tool Call Log History & Execution Details */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              RECENT MCP TOOL EXECUTIONS
            </h3>
            <span className="text-[10px] font-mono text-slate-500">LIVE GATEWAY STREAM</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden font-mono text-xs">
            <div className="bg-slate-950 p-3 border-b border-slate-800 grid grid-cols-5 text-slate-400 font-bold text-[11px]">
              <span>TIME</span>
              <span>TOOL NAME</span>
              <span className="col-span-2">ARGUMENTS (JSON)</span>
              <span>STATUS / LATENCY</span>
            </div>

            <div className="divide-y divide-slate-800 max-h-[420px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs italic">
                  No MCP tools executed yet. Submit a prompt or click Run Demo.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 grid grid-cols-5 items-center hover:bg-slate-800/50 transition-colors">
                    <span className="text-sky-400">{log.timestamp}</span>
                    <span className="font-bold text-amber-300">{log.toolName}</span>
                    <span className="col-span-2 text-slate-300 text-[11px] truncate font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">
                      {JSON.stringify(log.arguments)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        ✓ SUCCESS
                      </span>
                      <span className="text-slate-400 text-[10px]">{log.executionTimeMs} ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
