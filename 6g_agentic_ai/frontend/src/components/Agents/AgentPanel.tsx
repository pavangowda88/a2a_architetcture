import React from 'react';
import { FactoryAgent } from '../../types/factory';
import { Bot, Shield, Database, Cpu, Radio, ChevronRight } from 'lucide-react';

interface AgentPanelProps {
  agents: FactoryAgent[];
  onSelectAgent: (agent: FactoryAgent) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ agents, onSelectAgent }) => {
  const getAgentIcon = (role: string) => {
    switch (role) {
      case 'Supervisor':
        return Cpu;
      case 'AUSF':
        return Shield;
      case 'UDM':
        return Database;
      case 'Security':
        return Radio;
      default:
        return Bot;
    }
  };

  return (
    <div className="bg-[#0b0e17] border-r border-slate-800 p-3 w-64 flex flex-col justify-between select-none">
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase">
            AGENT NETWORK (A2A)
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {agents.filter((a) => a.state === 'ACTIVE').length} ONLINE
          </span>
        </div>

        {/* Agents List */}
        <div className="space-y-2">
          {agents.map((agent) => {
            const Icon = getAgentIcon(agent.role);
            const isActive = agent.state === 'ACTIVE';

            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className="group cursor-pointer p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/80 hover:border-sky-500/40 transition-all flex items-center justify-between"
              >
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`p-2 rounded-lg ${
                      agent.role === 'Supervisor'
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : agent.role === 'Security' || agent.role === 'AUSF'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-sky-300">
                        {agent.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-[10px] font-mono text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      <span>:{agent.port}</span>
                      <span>• {agent.oauthStatus}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            );
          })}
        </div>
      </div>

      {/* System Note */}
      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 space-y-1">
        <span className="text-sky-400 font-semibold uppercase block">A2A PROTOCOL:</span>
        <p>Agents communicate via peer REST & JSON-RPC over 6G network slices.</p>
      </div>
    </div>
  );
};
