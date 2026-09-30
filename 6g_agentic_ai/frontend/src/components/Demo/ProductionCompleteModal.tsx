import React from 'react';
import { CheckCircle2, Factory, Bot, Terminal, ShieldCheck, X } from 'lucide-react';

interface ProductionCompleteModalProps {
  orderId: string;
  onClose: () => void;
}

export const ProductionCompleteModal: React.FC<ProductionCompleteModalProps> = ({ orderId, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-lg bg-[#0c101a] border-2 border-emerald-500/80 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20 text-center space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 ring-4 ring-emerald-400/20 animate-pulse">
          <Factory className="w-10 h-10 text-white" />
        </div>

        <div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase tracking-widest">
            PRODUCTION COMPLETED
          </span>
          <h2 className="text-2xl font-mono font-extrabold text-white mt-2">ORDER #{orderId}</h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            6G Agentic-AI Autonomous Smart Factory Execution
          </p>
        </div>

        {/* Milestone Steps */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono text-left bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold p-1.5 rounded bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4" />
            <span>RAW MATERIAL READY</span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold p-1.5 rounded bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4" />
            <span>ROBOTIC ASSEMBLY ✓</span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold p-1.5 rounded bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4" />
            <span>6G QC INSPECTION ✓</span>
          </div>
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold p-1.5 rounded bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4" />
            <span>PACKAGING COMPLETE ✓</span>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center">
            <Bot className="w-5 h-5 text-sky-400 mb-1" />
            <span className="text-sm font-bold text-white">3 ROBOT AGENTS</span>
            <span className="text-[10px] text-slate-500">R01, R02, R03</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center">
            <Terminal className="w-5 h-5 text-amber-400 mb-1" />
            <span className="text-sm font-bold text-white">7 MCP CALLS</span>
            <span className="text-[10px] text-slate-500">FastMCP Gate</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mb-1" />
            <span className="text-sm font-bold text-white">0 VIOLATIONS</span>
            <span className="text-[10px] text-slate-500">OAuth Verified</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between font-bold text-emerald-400">
            <span>TOTAL FULFILLMENT</span>
            <span>100% COMPLETE</span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-emerald-500/30">
            <div className="w-full h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
        >
          CONFIRM & RETURN TO DASHBOARD
        </button>
      </div>
    </div>
  );
};
