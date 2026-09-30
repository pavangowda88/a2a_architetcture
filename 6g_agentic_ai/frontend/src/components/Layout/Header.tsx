import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Wifi, Radio, Bell, Play, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ConnectionStatusType, SystemStatusType } from '../../types/factory';

interface HeaderProps {
  systemStatus: SystemStatusType;
  mcpConnected: boolean;
  networkConnected: boolean;
  authActive: boolean;
  onStartDemo: () => void;
  onSimulateFailure: () => void;
  onReset: () => void;
  isDemoRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  systemStatus,
  mcpConnected,
  networkConnected,
  authActive,
  onStartDemo,
  onSimulateFailure,
  onReset,
  isDemoRunning,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0c1019]/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Title Brand */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20 ring-1 ring-sky-400/30">
          <Cpu className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold tracking-wider text-white font-mono uppercase">
              6G AUTONOMOUS SMART FACTORY
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-mono border border-sky-500/30 font-semibold tracking-wider">
              A2A + MCP TWIN v2.4
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">Mission Control Center & Digital Twin</p>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="hidden lg:flex items-center space-x-4 bg-slate-900/80 px-4 py-1.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <span className={`w-2.5 h-2.5 rounded-full ${systemStatus === 'ONLINE' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
          <span className="text-xs font-mono font-semibold text-slate-300">
            SYSTEM: <span className={systemStatus === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400'}>{systemStatus}</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-1.5">
          <Cpu className={`w-3.5 h-3.5 ${mcpConnected ? 'text-sky-400' : 'text-slate-500'}`} />
          <span className="text-xs font-mono text-slate-300">
            MCP: <span className={mcpConnected ? 'text-sky-400 font-medium' : 'text-slate-500'}>{mcpConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-1.5">
          <Wifi className={`w-3.5 h-3.5 ${networkConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
          <span className="text-xs font-mono text-slate-300">
            6G: <span className={networkConnected ? 'text-emerald-400 font-medium' : 'text-slate-500'}>{networkConnected ? 'SUBNET ACTIVE' : 'DISCONNECTED'}</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800" />

        <div className="flex items-center space-x-1.5">
          <ShieldCheck className={`w-3.5 h-3.5 ${authActive ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className="text-xs font-mono text-slate-300">
            KEYCLOAK: <span className={authActive ? 'text-amber-400 font-medium' : 'text-slate-500'}>{authActive ? 'OAUTH ACTIVE' : 'INACTIVE'}</span>
          </span>
        </div>
      </div>

      {/* Right Action Bar & Clock */}
      <div className="flex items-center space-x-3">
        {/* Demo Button */}
        <button
          onClick={onStartDemo}
          disabled={isDemoRunning}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition-all shadow-md ${
            isDemoRunning
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 cursor-wait'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20 active:scale-95'
          }`}
        >
          <Play className={`w-3.5 h-3.5 ${isDemoRunning ? 'animate-spin' : 'fill-current'}`} />
          <span>{isDemoRunning ? 'RUNNING DEMO...' : '▶ START DEMO'}</span>
        </button>

        {/* Failure Simulation Button */}
        <button
          onClick={onSimulateFailure}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all active:scale-95"
          title="Simulate Robot R02 failure and trigger agent self-healing recovery"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline">SIMULATE FAIL</span>
        </button>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-all"
          title="Reset Factory Simulation State"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Clock Badge */}
        <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-xs font-mono font-semibold text-sky-400">
          {timeStr || '10:42:00'}
        </div>
      </div>
    </header>
  );
};
