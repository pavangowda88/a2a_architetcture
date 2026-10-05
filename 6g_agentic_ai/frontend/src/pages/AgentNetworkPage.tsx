import React from 'react';
import { Robot } from '../types/factory';
import { ShieldCheck, Cpu, Database, Radio, Bot, Key, Server, Activity, ArrowDown } from 'lucide-react';

interface AgentNetworkPageProps {
  robots: Robot[];
}

export const AgentNetworkPage: React.FC<AgentNetworkPageProps> = ({ robots }) => {
  return (
    <main className="flex-1 p-4 md:p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm md:text-lg font-mono font-bold text-white uppercase tracking-wider">
              AGENT-TO-AGENT (A2A) NETWORK TOPOLOGY
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30">
              SAMPLE TOPOLOGY
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Illustrative network layout · agent cards and robot metrics below are seeded demo values, not a live registry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] md:text-xs font-mono">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
            <span>SEEDED STATE</span>
          </span>
          <span className="flex items-center space-x-1.5 text-sky-400">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <span>A2A ROUTE (BLUE)</span>
          </span>
          <span className="flex items-center space-x-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>SIMULATED PROCESSING (YELLOW)</span>
          </span>
        </div>
      </header>

      {/* Interactive Topology Graph Tree */}
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 py-2 md:py-4">
        {/* Layer 1: Keycloak Auth Server */}
        <div className="flex justify-center">
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/50 text-center w-64 max-w-full glow-amber">
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2 border border-amber-500/40">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-mono font-bold text-amber-300 uppercase">KEYCLOAK IDENTITY</h3>
            <p className="text-[10px] font-mono text-slate-400">OAuth 2.0 / OIDC Provider</p>
            <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300">
              REALM: LOCALHOST:8080/6G
            </span>
          </div>
        </div>

        <div className="flex justify-center text-slate-600">
          <ArrowDown className="w-6 h-6 text-sky-400" />
        </div>

        {/* Layer 2: Supervisor Agent */}
        <div className="flex justify-center">
          <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/60 text-center w-72 max-w-full glow-sky">
            <div className="w-10 h-10 mx-auto rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-2 border border-sky-500/40">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-mono font-bold text-sky-300 uppercase">SUPERVISOR AGENT</h3>
            <p className="text-[10px] font-mono text-slate-400">Central Orchestrator • Port 8000</p>
            <div className="mt-2 text-[10px] font-mono text-emerald-400 font-semibold">
              SAMPLE CONFIGURATION
            </div>
          </div>
        </div>

        <div className="flex justify-center text-slate-600">
          <ArrowDown className="w-6 h-6 text-sky-400" />
        </div>

        {/* Layer 3: Core Network Agents (AUSF, UDM, Security) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 max-w-3xl mx-auto">
          {/* AUSF Agent */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <ShieldCheck className="w-6 h-6 mx-auto text-amber-400 mb-1" />
            <h4 className="text-xs font-mono font-bold text-slate-200">AUSF AGENT</h4>
            <p className="text-[10px] font-mono text-slate-500">Port 8001 • Agent-AKA</p>
            <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400">
              SAMPLE · ACTIVE
            </span>
          </div>

          {/* UDM Agent */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <Database className="w-6 h-6 mx-auto text-purple-400 mb-1" />
            <h4 className="text-xs font-mono font-bold text-slate-200">UDM AGENT</h4>
            <p className="text-[10px] font-mono text-slate-500">Port 8003 • Profiles</p>
            <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400">
              SAMPLE · ACTIVE
            </span>
          </div>

          {/* Security Agent */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <Radio className="w-6 h-6 mx-auto text-rose-400 mb-1" />
            <h4 className="text-xs font-mono font-bold text-slate-200">SECURITY AGENT</h4>
            <p className="text-[10px] font-mono text-slate-500">Port 8105 • Trust Engine</p>
            <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400">
              SAMPLE · ACTIVE
            </span>
          </div>
        </div>

        <div className="flex justify-center text-slate-600">
          <ArrowDown className="w-6 h-6 text-sky-400" />
        </div>

        {/* Layer 4: FastMCP Gateway */}
        <div className="flex justify-center">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-sky-500/40 text-center w-72 max-w-full">
            <Server className="w-6 h-6 mx-auto text-sky-400 mb-1" />
            <h3 className="text-xs font-mono font-bold text-white uppercase">FASTMCP SERVER GATEWAY</h3>
            <p className="text-[10px] font-mono text-slate-400">Port 8010 • Streamable HTTP</p>
            <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-mono bg-sky-500/20 text-sky-300 font-bold">
              ENDPOINT: /mcp
            </span>
          </div>
        </div>

        <div className="flex justify-center text-slate-600">
          <ArrowDown className="w-6 h-6 text-emerald-400" />
        </div>

        {/* Layer 5: Robot Agents R1, R2, R3 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {robots.map((robot) => (
            <div
              key={robot.id}
              className={`p-4 rounded-2xl border text-center transition-all ${
                robot.status === 'ERROR'
                  ? 'bg-rose-950/30 border-rose-500/60 text-rose-300'
                  : robot.status === 'MOVING' || robot.status === 'BUSY'
                  ? 'bg-amber-950/30 border-amber-500/60 text-amber-200'
                  : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              <Bot className="w-7 h-7 mx-auto text-sky-400 mb-1" />
              <h4 className="text-xs font-mono font-bold text-white">{robot.name}</h4>
              <p className="text-[10px] font-mono text-slate-400">IMSI: {robot.imsi}</p>
              <div className="mt-2 text-[10px] font-mono flex items-center justify-center space-x-2">
                <span className="text-slate-400">SAMPLE · {robot.status}</span>
                <span className="text-slate-500">•</span>
                <span className="text-amber-400">{robot.battery}% BAT</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};
