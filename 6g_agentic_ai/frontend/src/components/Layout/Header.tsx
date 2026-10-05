import React, { useState, useEffect } from 'react';
import { Cpu, Play, RefreshCw, AlertTriangle, MoreHorizontal } from 'lucide-react';

interface HeaderProps {
  gatewayStatus: 'checking' | 'connected' | 'offline';
  modeLabel?: string;
  onStartDemo: () => void;
  onSimulateFailure: () => void;
  onReset: () => void;
  isDemoRunning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  gatewayStatus,
  modeLabel,
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
    <header className="app-topbar h-16 border-b border-slate-800/80 bg-[#0c1019]/90 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-40 select-none">
      {/* Title Brand */}
      <div className="flex items-center space-x-3">
        <div className="brand-mark w-10 h-10 rounded-xl flex items-center justify-center">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-semibold tracking-wide text-white uppercase">
              6G core operations
            </h1>
            <span className="product-tag">
              6G · A2A · MCP
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Agent network · factory simulation</p>
        </div>
      </div>

      {/* The status endpoint checks the MCP gateway and its live tool catalog. */}
      <div className="system-status-group hidden lg:flex items-center space-x-4 px-4 py-1.5 rounded-xl">
        <div className="flex items-center space-x-2">
          <span className={`status-indicator ${gatewayStatus === 'connected' ? 'online' : gatewayStatus === 'offline' ? 'offline' : 'checking'}`} />
          <span className="text-[11px] font-medium text-slate-300">
            Gateway <span className={gatewayStatus === 'connected' ? 'text-emerald-400' : gatewayStatus === 'offline' ? 'text-rose-400' : 'text-amber-400'}>{gatewayStatus === 'connected' ? 'Reachable' : gatewayStatus === 'offline' ? 'Offline' : 'Checking'}</span>
          </span>
        </div>
      </div>

      {/* Right Action Bar & Clock */}
      <div className="flex items-center space-x-3">
        {modeLabel && <span className="data-mode-badge">{modeLabel}</span>}
        {/* Demo Button */}
        <button
          onClick={onStartDemo}
          disabled={isDemoRunning}
          className={`demo-button flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            isDemoRunning
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 cursor-wait'
              : 'text-white active:scale-[0.98]'
          }`}
        >
          <Play className={`w-3.5 h-3.5 ${isDemoRunning ? 'animate-spin' : 'fill-current'}`} />
          <span>{isDemoRunning ? 'Running…' : 'Start demo'}</span>
        </button>

        <details className="header-more">
          <summary aria-label="More factory actions" title="More actions"><MoreHorizontal size={18} /></summary>
          <div className="header-more-menu">
            <button onClick={(event) => { onSimulateFailure(); event.currentTarget.closest('details')?.removeAttribute('open'); }}><AlertTriangle size={15} /><span>Simulate robot failure</span></button>
            <button onClick={(event) => { onReset(); event.currentTarget.closest('details')?.removeAttribute('open'); }}><RefreshCw size={15} /><span>Reset factory</span></button>
          </div>
        </details>

        {/* Clock Badge */}
        <div className="clock-display px-2.5 py-1 rounded-lg text-xs font-mono text-slate-400">
          {timeStr || '10:42:00'}
        </div>
      </div>
    </header>
  );
};
