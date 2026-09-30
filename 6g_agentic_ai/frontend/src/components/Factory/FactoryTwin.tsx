import React from 'react';
import { Robot, Station, Package, StationId } from '../../types/factory';
import {
  PackageCheck,
  Wrench,
  Scan,
  BoxSelect,
  Bot,
  Package as PackageIcon,
  Zap,
  ShieldCheck,
  AlertCircle,
  Activity,
  ArrowRight
} from 'lucide-react';

interface FactoryTwinProps {
  stations: Station[];
  robots: Robot[];
  packages: Package[];
  activeConveyor: boolean;
  onSelectRobot: (robot: Robot) => void;
  onSelectStation: (station: Station) => void;
  onSelectPackage: (pkg: Package) => void;
  laserScanning: boolean;
}

export const FactoryTwin: React.FC<FactoryTwinProps> = ({
  stations,
  robots,
  packages,
  activeConveyor,
  onSelectRobot,
  onSelectStation,
  onSelectPackage,
  laserScanning,
}) => {
  const getStation = (id: StationId) => stations.find((s) => s.id === id);

  return (
    <div className="relative w-full h-full bg-[#080b12] rounded-2xl border border-slate-800/90 overflow-hidden flex flex-col justify-between shadow-2xl select-none">
      {/* Background Grid Pattern & Industrial Overlay */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #38bdf8 1px, transparent 1px),
            linear-gradient(to bottom, #38bdf8 1px, transparent 1px)
          `,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Control Center Header Banner */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <Activity className="w-4 h-4 text-sky-400 animate-pulse" />
          <span className="text-slate-300 font-semibold">DIGITAL TWIN REAL-TIME MODEL</span>
        </div>

        <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">CONVEYOR SPEED:</span>
          <span className={`font-bold ${activeConveyor ? 'text-emerald-400' : 'text-slate-500'}`}>
            {activeConveyor ? '1.4 M/S (ACTIVE)' : 'STOPPED'}
          </span>
        </div>
      </div>

      {/* Main Interactive Canvas Container */}
      <div className="relative w-full h-full min-h-[480px] p-6 flex flex-col justify-between pt-14">
        {/* SVG Motion Trajectories & Conveyor Path Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="conveyorGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Conveyor Belt Path Line 1: Raw Material (18%, 42%) -> Assembly (48%, 42%) */}
          <line
            x1="22%"
            y1="45%"
            x2="44%"
            y2="45%"
            stroke="url(#conveyorGlow)"
            strokeWidth="6"
            strokeDasharray="8 6"
            className={activeConveyor ? 'animate-[dash_1s_linear_infinite]' : ''}
          />

          {/* Conveyor Belt Path Line 2: Assembly (48%, 42%) -> Inspection (78%, 42%) */}
          <line
            x1="52%"
            y1="45%"
            x2="74%"
            y2="45%"
            stroke="url(#conveyorGlow)"
            strokeWidth="6"
            strokeDasharray="8 6"
            className={activeConveyor ? 'animate-[dash_1s_linear_infinite]' : ''}
          />

          {/* Conveyor Belt Path Line 3: Inspection (78%, 42%) -> Packaging (78%, 78%) */}
          <line
            x1="78%"
            y1="55%"
            x2="78%"
            y2="72%"
            stroke="url(#conveyorGlow)"
            strokeWidth="6"
            strokeDasharray="8 6"
            className={activeConveyor ? 'animate-[dash_1s_linear_infinite]' : ''}
          />

          {/* Motion Trajectories for Active Moving Robots */}
          {robots.map((r) => {
            if (r.status === 'MOVING' && r.targetLocation) {
              const targetStn = getStation(r.targetLocation as StationId);
              if (targetStn) {
                let tx = 18;
                let ty = 42;
                if (r.targetLocation === 'assembly') tx = 48;
                if (r.targetLocation === 'inspection') tx = 78;
                if (r.targetLocation === 'packaging') {
                  tx = 78;
                  ty = 78;
                }

                return (
                  <line
                    key={`traj-${r.id}`}
                    x1={`${r.x}%`}
                    y1={`${r.y}%`}
                    x2={`${tx}%`}
                    y2={`${ty}%`}
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="animate-pulse"
                  />
                );
              }
            }
            return null;
          })}
        </svg>

        {/* ---------------- STATIONS LAYER ---------------- */}
        <div className="relative w-full h-full z-10 grid grid-cols-4 gap-4 items-center">
          {/* Station 1: Raw Material */}
          <div
            onClick={() => onSelectStation(stations[0])}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-sky-500/50 p-4 rounded-2xl transition-all shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">RAW MATERIAL</h3>
                  <p className="text-[10px] font-mono text-slate-400">STN-01 • Inbound Feeder</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                READY
              </span>
            </div>

            {/* Packages at Station */}
            <div className="my-3 flex items-center space-x-1.5 flex-wrap gap-y-1">
              {packages
                .filter((p) => p.currentStation === 'raw_material')
                .map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPackage(pkg);
                    }}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono px-2 py-1 rounded-md flex items-center space-x-1 animate-pulse"
                  >
                    <PackageIcon className="w-3 h-3" />
                    <span>{pkg.name}</span>
                  </button>
                ))}
              {packages.filter((p) => p.currentStation === 'raw_material').length === 0 && (
                <span className="text-[11px] font-mono text-slate-500 italic">No packages queued</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
              <span>STORAGE: 4/10</span>
              <span className="text-sky-400 font-semibold group-hover:translate-x-1 transition-transform">
                INSPECT ➔
              </span>
            </div>
          </div>

          {/* Station 2: Assembly Area */}
          <div
            onClick={() => onSelectStation(stations[1])}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-emerald-500/50 p-4 rounded-2xl transition-all shadow-xl hover:shadow-emerald-500/10 flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">ROBOTIC ASSEMBLY</h3>
                  <p className="text-[10px] font-mono text-slate-400">STN-02 • Cell #1</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                STATION ACTIVE
              </span>
            </div>

            <div className="my-3 flex items-center space-x-1.5 flex-wrap gap-y-1">
              {packages
                .filter((p) => p.currentStation === 'assembly')
                .map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPackage(pkg);
                    }}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono px-2 py-1 rounded-md flex items-center space-x-1"
                  >
                    <PackageIcon className="w-3 h-3" />
                    <span>{pkg.name}</span>
                  </button>
                ))}
              {packages.filter((p) => p.currentStation === 'assembly').length === 0 && (
                <span className="text-[11px] font-mono text-slate-500 italic">Waiting for workpiece</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
              <span>TOOL: WELD / JOIN</span>
              <span className="text-emerald-400 font-semibold group-hover:translate-x-1 transition-transform">
                INSPECT ➔
              </span>
            </div>
          </div>

          {/* Station 3: 6G Laser Inspection */}
          <div
            onClick={() => onSelectStation(stations[2])}
            className={`group cursor-pointer bg-slate-900/80 hover:bg-slate-800/90 border p-4 rounded-2xl transition-all shadow-xl flex flex-col justify-between min-h-[160px] ${
              laserScanning
                ? 'border-purple-500/80 ring-2 ring-purple-500/40 shadow-purple-500/20'
                : 'border-slate-700/80 hover:border-purple-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  <Scan className={`w-5 h-5 ${laserScanning ? 'animate-bounce' : ''}`} />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">6G INSPECTION</h3>
                  <p className="text-[10px] font-mono text-slate-400">STN-03 • Laser QC</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  laserScanning
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {laserScanning ? 'SCANNING (6G)' : 'READY'}
              </span>
            </div>

            <div className="my-3 flex items-center space-x-1.5 flex-wrap gap-y-1">
              {packages
                .filter((p) => p.currentStation === 'inspection')
                .map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPackage(pkg);
                    }}
                    className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-mono px-2 py-1 rounded-md flex items-center space-x-1"
                  >
                    <PackageIcon className="w-3 h-3" />
                    <span>{pkg.name}</span>
                  </button>
                ))}
              {packages.filter((p) => p.currentStation === 'inspection').length === 0 && (
                <span className="text-[11px] font-mono text-slate-500 italic">Clear</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
              <span>LATENCY: 12ms</span>
              <span className="text-purple-400 font-semibold group-hover:translate-x-1 transition-transform">
                INSPECT ➔
              </span>
            </div>
          </div>

          {/* Station 4: Packaging Area */}
          <div
            onClick={() => onSelectStation(stations[3])}
            className="group cursor-pointer bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/50 p-4 rounded-2xl transition-all shadow-xl hover:shadow-cyan-500/10 flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <BoxSelect className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">PACKAGING</h3>
                  <p className="text-[10px] font-mono text-slate-400">STN-04 • Outbound Dispatch</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                DISPATCH READY
              </span>
            </div>

            <div className="my-3 flex items-center space-x-1.5 flex-wrap gap-y-1">
              {packages
                .filter((p) => p.currentStation === 'packaging')
                .map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPackage(pkg);
                    }}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono px-2 py-1 rounded-md flex items-center space-x-1 font-bold"
                  >
                    <PackageIcon className="w-3 h-3 text-emerald-400" />
                    <span>{pkg.name} ✓</span>
                  </button>
                ))}
              {packages.filter((p) => p.currentStation === 'packaging').length === 0 && (
                <span className="text-[11px] font-mono text-slate-500 italic">Empty</span>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
              <span>OUTBOUND CONVEYOR</span>
              <span className="text-cyan-400 font-semibold group-hover:translate-x-1 transition-transform">
                INSPECT ➔
              </span>
            </div>
          </div>
        </div>

        {/* ---------------- ROBOTS LAYER ---------------- */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {robots.map((robot) => {
            const isMoving = robot.status === 'MOVING' || robot.status === 'BUSY';
            const isError = robot.status === 'ERROR' || robot.status === 'OFFLINE';

            return (
              <div
                key={robot.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRobot(robot);
                }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto transition-all duration-700 ease-out ${
                  isMoving ? 'scale-105' : ''
                }`}
                style={{
                  left: `${robot.x}%`,
                  top: `${robot.y}%`,
                }}
              >
                {/* Robot Badge Box */}
                <div
                  className={`flex flex-col items-center p-2.5 rounded-xl border backdrop-blur-md shadow-2xl transition-all ${
                    isError
                      ? 'bg-rose-950/90 border-rose-500/80 text-rose-300 ring-2 ring-rose-500/50 glow-rose'
                      : isMoving
                      ? 'bg-amber-950/90 border-amber-400/80 text-amber-200 ring-2 ring-amber-400/50 glow-amber'
                      : 'bg-slate-900/90 border-sky-500/50 text-sky-200 hover:border-sky-400 glow-sky'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isError ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      <Bot className={`w-5 h-5 ${isMoving ? 'animate-bounce' : ''}`} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-mono font-bold text-white">{robot.id}</span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isError ? 'bg-rose-500' : isMoving ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-300 uppercase block">
                        {robot.status}
                      </span>
                    </div>
                  </div>

                  {/* Attached Carrying Package */}
                  {robot.carryingPackageId && (
                    <div className="mt-1.5 px-2 py-0.5 rounded bg-amber-500/30 border border-amber-400/50 text-amber-300 text-[9px] font-mono flex items-center space-x-1 animate-pulse">
                      <PackageIcon className="w-2.5 h-2.5" />
                      <span>{robot.carryingPackageId}</span>
                    </div>
                  )}

                  {/* Battery & OAuth Bar */}
                  <div className="mt-1.5 w-full flex items-center justify-between text-[9px] font-mono text-slate-400 border-t border-slate-800 pt-1 space-x-2">
                    <span className="flex items-center space-x-0.5">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span>{robot.battery}%</span>
                    </span>
                    <span className="text-emerald-400 flex items-center space-x-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>OAuth</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
