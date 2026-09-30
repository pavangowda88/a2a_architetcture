import React from 'react';
import { Robot } from '../../types/factory';
import { X, Bot, BatteryCharging, Gauge, ShieldCheck, Terminal, AlertTriangle, CheckCircle2, Play, Square } from 'lucide-react';

interface RobotDetailModalProps {
  robot: Robot | null;
  onClose: () => void;
  onStopRobot: (robotId: string) => void;
}

export const RobotDetailModal: React.FC<RobotDetailModalProps> = ({ robot, onClose, onStopRobot }) => {
  if (!robot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d121d] border border-slate-800 rounded-2xl shadow-2xl p-5 flex flex-col justify-between space-y-4 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">{robot.name}</h2>
              <p className="text-xs font-mono text-slate-400">AGENT ID: {robot.agentId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center space-x-3">
            <BatteryCharging className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">BATTERY LEVEL</span>
              <span className="text-sm font-bold text-slate-200">{robot.battery}%</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center space-x-3">
            <Gauge className="w-5 h-5 text-sky-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">OPERATING SPEED</span>
              <span className="text-sm font-bold text-slate-200">{robot.speed} m/s</span>
            </div>
          </div>
        </div>

        {/* Status Details */}
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">OPERATIONAL STATUS:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                robot.status === 'ERROR'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : robot.status === 'MOVING' || robot.status === 'BUSY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              ● {robot.status}
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">CURRENT LOCATION:</span>
            <span className="font-semibold text-slate-200 uppercase">{robot.location}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">CURRENT TASK:</span>
            <span className="font-semibold text-sky-400">{robot.currentTask || 'Idle / Ready'}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">SKILL ADVERTISED:</span>
            <span className="font-semibold text-amber-300">{robot.skill}</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">MAX PAYLOAD:</span>
            <span className="font-semibold text-slate-200">{robot.maxPayloadKg} kg</span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">OAUTH SECURITY:</span>
            <span className="text-emerald-400 font-semibold flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{robot.oauthStatus}</span>
            </span>
          </div>

          <div className="flex justify-between py-1.5 border-b border-slate-800/80">
            <span className="text-slate-400">FAST MCP ACCESS:</span>
            <span className="text-sky-400 font-semibold flex items-center space-x-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>{robot.mcpAccess ? '✓ AUTHORIZED' : 'DENIED'}</span>
            </span>
          </div>
        </div>

        {/* Task Checkpoint Checklist */}
        <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1.5 text-xs font-mono">
          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
            TASK CHECKPOINTS
          </span>
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Receive assignment via MCP</span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Keycloak OAuth Token Introspected</span>
          </div>
          <div
            className={`flex items-center space-x-2 ${
              robot.status === 'MOVING' || robot.status === 'BUSY' ? 'text-amber-400 animate-pulse' : 'text-slate-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Move package to destination</span>
          </div>
          <div className="flex items-center space-x-2 text-slate-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Deliver workpiece & confirm</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex items-center space-x-3">
          <button
            onClick={() => onStopRobot(robot.id)}
            className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold transition-all active:scale-95"
          >
            <Square className="w-4 h-4 text-rose-400 fill-current" />
            <span>STOP ROBOT (E-STOP)</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold border border-slate-700 transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
