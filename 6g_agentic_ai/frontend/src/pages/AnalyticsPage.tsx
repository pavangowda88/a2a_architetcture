import React from 'react';
import { FactoryAnalyticsData } from '../types/factory';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Activity, Bot, Terminal, CheckCircle2, Zap, Wifi } from 'lucide-react';

interface AnalyticsPageProps {
  analytics: FactoryAnalyticsData;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ analytics }) => {
  const COLORS = ['#38bdf8', '#10b981', '#a855f7', '#f59e0b'];

  return (
    <div className="flex-1 p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-wider">
              FACTORY ANALYTICS & TELEMETRY
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
              REAL-TIME RECHARTS ENGINE
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Key performance indicators, agent message throughput, robot utilization, and latency metrics
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4 font-mono text-xs">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase">TOTAL TASKS</span>
          <div className="text-xl font-bold text-white flex items-center justify-between">
            <span>{analytics.totalTasks}</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-[10px] text-slate-400">35 Completed • 12 Active</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase">MCP TOOL CALLS</span>
          <div className="text-xl font-bold text-sky-400 flex items-center justify-between">
            <span>{analytics.mcpCalls}</span>
            <Terminal className="w-5 h-5 text-sky-400" />
          </div>
          <p className="text-[10px] text-slate-400">FastMCP Streamable Gateway</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase">AGENT A2A MESSAGES</span>
          <div className="text-xl font-bold text-purple-400 flex items-center justify-between">
            <span>{analytics.agentMessages}</span>
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-[10px] text-slate-400">Inter-agent communication</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
          <span className="text-[10px] text-slate-500 uppercase">NETWORK LATENCY</span>
          <div className="text-xl font-bold text-emerald-400 flex items-center justify-between">
            <span>{analytics.networkLatencyMs} ms</span>
            <Wifi className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-[10px] text-slate-400">6G Dedicated Network Slice</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6 font-mono">
        {/* Task Fulfillment & MCP Call Trends */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            TASKS & MCP CALLS OVER TIME
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.taskTrends}>
                <defs>
                  <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorMcp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="tasks" stroke="#38bdf8" fillOpacity={1} fill="url(#colorTasks)" />
                <Area type="monotone" dataKey="mcpCalls" stroke="#10b981" fillOpacity={1} fill="url(#colorMcp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Robot Utilization Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            ROBOT UTILIZATION PERCENTAGE (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.robotUtilization}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Bar dataKey="utilization" fill="#38bdf8" radius={[6, 6, 0, 0]}>
                  {analytics.robotUtilization.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
