import React from 'react';
import { SecurityStatus } from '../types/factory';
import { ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2, UserCheck, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';

interface SecurityCenterPageProps {
  security: SecurityStatus;
}

export const SecurityCenterPage: React.FC<SecurityCenterPageProps> = ({ security }) => {
  return (
    <div className="flex-1 p-6 bg-[#080b12] overflow-y-auto space-y-6 text-slate-200 select-none">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-wider">
              SECURITY & OAUTH CONTROL CENTER
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
              KEYCLOAK 2.0 OIDC
            </span>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Zero-Trust Agent Security, Agent-AKA vector verification, and OAuth token introspection
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-bold">ZERO TRUST: ACTIVE</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4 text-xs font-mono">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center space-x-3">
          <Key className="w-6 h-6 text-amber-400" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">KEYCLOAK SERVER</span>
            <span className="text-sm font-bold text-emerald-400">CONNECTED</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center space-x-3">
          <ShieldCheck className="w-6 h-6 text-sky-400" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">ACTIVE TOKENS</span>
            <span className="text-sm font-bold text-white">{security.activeTokensCount} VALIDATED</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center space-x-3">
          <ShieldAlert className="w-6 h-6 text-emerald-400" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">UNAUTHORIZED CALLS</span>
            <span className="text-sm font-bold text-emerald-400">{security.unauthorizedCallsCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center space-x-3">
          <Lock className="w-6 h-6 text-purple-400" />
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">SECURITY VIOLATIONS</span>
            <span className="text-sm font-bold text-emerald-400">{security.securityEventsCount}</span>
          </div>
        </div>
      </div>

      {/* Authentication Sequence Diagram */}
      <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-3">
        <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider block">
          OAUTH 2.0 / AGENT-AKA AUTHENTICATION SEQUENCE
        </span>
        <div className="flex items-center justify-between text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-3 py-1.5 rounded bg-slate-800 text-sky-300 font-bold border border-sky-500/30">
              ROBOT AGENT
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-3 py-1.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-500/30">
              OAUTH AUTHENTICATION
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-3 py-1.5 rounded bg-purple-950 text-purple-300 font-bold border border-purple-500/30">
              KEYCLOAK INTROSPECT
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-3 py-1.5 rounded bg-sky-950 text-sky-300 font-bold border border-sky-500/30">
              MCP SERVER VALIDATED
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500" />
          </div>

          <div className="flex items-center space-x-2 text-slate-300">
            <span className="px-3 py-1.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/30">
              ✓ AUTHORIZED TOOL CALL
            </span>
          </div>
        </div>
      </div>

      {/* Agents Security Status Checklist */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
          AUTHENTICATED SYSTEM ENTITIES
        </h3>

        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Cpu className="w-5 h-5 text-sky-400" />
              <div>
                <span className="font-bold text-white block">Supervisor Agent</span>
                <span className="text-[10px] text-slate-500">Port 8000 • IMSI Verified</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ✓ AUTHENTICATED
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <div>
                <span className="font-bold text-white block">FastMCP Server Gateway</span>
                <span className="text-[10px] text-slate-500">Port 8010 • Token Introspected</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ✓ AUTHENTICATED
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-white block">Robot R01 Agent</span>
                <span className="text-[10px] text-slate-500">IMSI: 001010123456789</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ✓ AUTHENTICATED
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-white block">Robot R02 Agent</span>
                <span className="text-[10px] text-slate-500">IMSI: 001010000000001</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ✓ AUTHENTICATED
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between col-span-2">
            <div className="flex items-center space-x-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="font-bold text-white block">Robot R03 Agent</span>
                <span className="text-[10px] text-slate-500">IMSI: 001010000000002</span>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ✓ AUTHENTICATED
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
