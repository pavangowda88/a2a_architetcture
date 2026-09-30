import React from 'react';
import { Package } from '../types/factory';
import { CheckCircle2, Clock, CheckSquare, Play, AlertCircle, Package as PackageIcon } from 'lucide-react';

interface TasksPageProps {
  packages: Package[];
}

export const TasksPage: React.FC<TasksPageProps> = ({ packages }) => {
  return (
    <div className="flex-1 p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-wider">
              FACTORY TASK MANAGEMENT
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400 border border-sky-500/30 font-bold">
              {packages.length} PRODUCTION ORDERS
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Active manufacturing work orders, station progress checkpoints, and robot allocations
          </p>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-2 gap-6">
        {packages.map((pkg) => {
          const isCompleted = pkg.progressPercent === 100;
          return (
            <div
              key={pkg.id}
              className={`p-5 rounded-2xl border transition-all space-y-4 ${
                isCompleted
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-900/90 border-sky-500/40 shadow-lg shadow-sky-500/10'
              }`}
            >
              {/* Task Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PackageIcon className="w-5 h-5 text-sky-400" />
                  <div>
                    <h3 className="text-sm font-mono font-bold text-white">TASK #{pkg.orderId}</h3>
                    <p className="text-xs font-mono text-slate-400">{pkg.name}</p>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  }`}
                >
                  {isCompleted ? '✓ 100% COMPLETED' : `IN PROGRESS (${pkg.progressPercent}%)`}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>FULFILLMENT PROGRESS</span>
                  <span className="font-bold text-sky-400">{pkg.progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-sky-500 to-blue-500'
                    }`}
                    style={{ width: `${pkg.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Station Checkpoints */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Material Storage</span>
                </div>

                <div
                  className={`flex items-center space-x-2 font-semibold ${
                    pkg.progressPercent >= 40 ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assembly Area</span>
                </div>

                <div
                  className={`flex items-center space-x-2 font-semibold ${
                    pkg.progressPercent >= 75 ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Laser Inspection</span>
                </div>

                <div
                  className={`flex items-center space-x-2 font-semibold ${
                    pkg.progressPercent === 100 ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Packaging & Dispatch</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
