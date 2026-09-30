import React from 'react';
import {
  Factory,
  Network,
  Terminal,
  Shield,
  CheckSquare,
  BarChart3,
  FileText,
  Bot
} from 'lucide-react';

export type PageId = 'factory' | 'network' | 'mcp' | 'security' | 'tasks' | 'analytics' | 'logs';

interface SidebarProps {
  currentPage: PageId;
  onPageChange: (page: PageId) => void;
  activeTaskCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, activeTaskCount }) => {
  const navItems = [
    { id: 'factory', label: 'Factory Overview', icon: Factory, badge: null },
    { id: 'network', label: 'Agent Network', icon: Network, badge: 'A2A' },
    { id: 'mcp', label: 'MCP Control Center', icon: Terminal, badge: '8 TOOLS' },
    { id: 'security', label: 'Security Center', icon: Shield, badge: 'OAUTH' },
    { id: 'tasks', label: 'Task Management', icon: CheckSquare, badge: activeTaskCount > 0 ? activeTaskCount : null },
    { id: 'analytics', label: 'Factory Analytics', icon: BarChart3, badge: null },
    { id: 'logs', label: 'System Logs', icon: FileText, badge: 'LIVE' },
  ];

  return (
    <aside className="w-56 bg-[#0a0d16] border-r border-slate-800 flex flex-col justify-between select-none py-3">
      <div className="space-y-1 px-2">
        <div className="px-3 py-2 text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase">
          NAVIGATION
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id as PageId)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono font-medium transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="px-3">
        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1">
          <div className="flex items-center space-x-2 text-slate-300">
            <Bot className="w-4 h-4 text-sky-400" />
            <span className="font-semibold">3 ROBOT AGENTS</span>
          </div>
          <p className="text-[11px] text-slate-400">R01 Material • R02 Assembly • R03 Inspection</p>
        </div>
      </div>
    </aside>
  );
};
