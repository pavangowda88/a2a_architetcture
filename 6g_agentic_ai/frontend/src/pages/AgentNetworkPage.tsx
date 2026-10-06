import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  Bot,
  Database,
  KeyRound,
  Network,
  Search,
  Server,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

const coreAgents = [
  { name: 'AUSF Agent', port: '8001', purpose: 'Agent-AKA authentication', skills: 'auth · /authenticate', icon: ShieldCheck, tone: 'border-amber-700 bg-amber-50 text-amber-950' },
  { name: 'Subscriber Agent', port: '8002', purpose: 'QoS lookup and session updates', skills: 'qos · session', icon: UserRound, tone: 'border-emerald-700 bg-emerald-50 text-emerald-950' },
  { name: 'UDM / UDR Agent', port: '8003', purpose: 'Subscriber data and auth vectors', skills: 'auth-vectors · sub-data · ue-profile', icon: Database, tone: 'border-cyan-800 bg-cyan-50 text-cyan-950' },
  { name: 'Security Agent', port: '8105', purpose: 'Trust scoring and risk recovery', skills: 'trust · re-evaluate', icon: ShieldCheck, tone: 'border-rose-800 bg-rose-50 text-rose-950' },
];

const routes = [
  { from: 'UE Agents', to: 'Supervisor', label: 'orchestrate', detail: 'Attach and service requests are discovered through the Registry, then sent by A2A.' },
  { from: 'Supervisor', to: 'AUSF / Subscriber', label: 'auth · qos · session', detail: 'The Supervisor resolves each requested skill and calls the owning agent directly.' },
  { from: 'AUSF', to: 'UDM + Security', label: 'auth-vectors · trust · reverify-sub · re-evaluate', detail: 'AUSF gathers vectors and trust; low-trust recovery re-verifies with UDM and re-scores with Security.' },
  { from: 'UE Agent 001', to: 'UE Agent 002', label: 'peer-message · /messages', detail: 'UE agents resolve one another by registry ID and exchange authenticated direct messages.' },
];

export const AgentNetworkPage: React.FC = () => (
  <main className="flex-1 min-w-0 overflow-y-auto bg-[#edf3f7] p-4 text-slate-950 md:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col gap-3 border-b-2 border-slate-400 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-sky-900"><Network className="h-4 w-4" />Nokia 6G Agentic AI</div>
          <h1 className="text-lg font-bold uppercase text-slate-950 md:text-xl">A2A Agent Network</h1>
          <p className="mt-1 max-w-3xl text-sm font-medium text-slate-700">Project architecture: agents discover skills through the Registry and send authenticated JSON-RPC messages directly to each other.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="border border-sky-800 bg-sky-100 px-2.5 py-1 text-sky-950">A2A MESSAGE PATH</span>
          <span className="border border-amber-800 bg-amber-100 px-2.5 py-1 text-amber-950">OAUTH 2.0 / OIDC</span>
        </div>
      </header>

      <section aria-label="Shared identity" className="flex flex-col items-center">
        <div className="flex w-full max-w-2xl items-center gap-4 border-2 border-amber-800 bg-amber-50 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center border border-amber-800 bg-amber-200 text-amber-950"><KeyRound className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold uppercase text-amber-950">Keycloak Identity Provider</h2>
            <p className="text-sm font-semibold text-slate-800">OAuth 2.0 client credentials · OIDC realm: 6g</p>
            <p className="text-xs font-bold text-slate-700">localhost:8080 · tokens used on protected A2A calls</p>
          </div>
        </div>
        <ArrowDown aria-hidden="true" className="my-2 h-5 w-5 text-amber-900" />
        <p className="text-center text-xs font-bold uppercase text-slate-700">Shared authentication for protected agent requests</p>
      </section>

      <section aria-label="Agent discovery and orchestration" className="grid gap-3 md:grid-cols-3">
        <article className="border-2 border-cyan-800 bg-white p-4">
          <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-cyan-800 bg-cyan-100 text-cyan-950"><Search className="h-5 w-5" /></span><div><h2 className="text-sm font-bold uppercase text-slate-950">Agent Registry</h2><p className="text-xs font-bold text-slate-700">Port 9001</p></div></div>
          <p className="text-sm font-medium text-slate-800">Stores agent cards and resolves skill IDs to agent URLs.</p>
          <p className="mt-2 border-t border-slate-300 pt-2 text-xs font-bold text-cyan-950">DISCOVERY ONLY · DOES NOT RELAY A2A MESSAGES</p>
        </article>
        <article className="border-2 border-sky-800 bg-sky-50 p-4">
          <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-sky-800 bg-sky-200 text-sky-950"><Network className="h-5 w-5" /></span><div><h2 className="text-sm font-bold uppercase text-slate-950">Supervisor Agent</h2><p className="text-xs font-bold text-slate-700">Port 8000 · central orchestrator</p></div></div>
          <p className="text-sm font-medium text-slate-800">Accepts UE requests, looks up the required skill, then calls the matching agent.</p>
          <p className="mt-2 border-t border-sky-300 pt-2 text-xs font-bold text-sky-950">A2A SKILL · orchestrate · /task</p>
        </article>
        <article className="border-2 border-emerald-800 bg-white p-4">
          <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-emerald-800 bg-emerald-100 text-emerald-950"><Server className="h-5 w-5" /></span><div><h2 className="text-sm font-bold uppercase text-slate-950">Notification Agent</h2><p className="text-xs font-bold text-slate-700">Port 8106</p></div></div>
          <p className="text-sm font-medium text-slate-800">Receives card-change notices and forwards them to the Supervisor.</p>
          <p className="mt-2 border-t border-slate-300 pt-2 text-xs font-bold text-emerald-950">CARD UPDATES · /notify → SUPERVISOR → REGISTRY</p>
        </article>
      </section>

      <div className="grid grid-cols-1 gap-2 text-center text-xs font-bold uppercase text-slate-700 md:grid-cols-3">
        <div className="flex items-center justify-center gap-2"><ArrowRight className="h-4 w-4 text-cyan-900" />Skill lookup</div>
        <div className="flex items-center justify-center gap-2"><ArrowRight className="h-4 w-4 text-sky-900" />Direct A2A task call</div>
        <div className="flex items-center justify-center gap-2"><ArrowRight className="h-4 w-4 text-emerald-900" />Card update forwarding</div>
      </div>

      <section aria-label="6G network agents">
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-slate-400 pb-2"><div><h2 className="text-sm font-bold uppercase text-slate-950">6G Core Agents</h2><p className="text-xs font-semibold text-slate-700">Skill-addressed services registered with the Registry</p></div><span className="text-xs font-bold text-slate-700">4 AGENTS</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {coreAgents.map(({ name, port, purpose, skills, icon: Icon, tone }) => (
            <article key={name} className={`border-2 p-4 ${tone}`}>
              <div className="mb-3 flex items-center justify-between gap-2"><Icon aria-hidden="true" className="h-6 w-6" /><span className="border border-current px-2 py-0.5 text-xs font-bold">:{port}</span></div>
              <h3 className="text-sm font-bold uppercase">{name}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-800">{purpose}</p>
              <p className="mt-3 border-t border-current/30 pt-2 text-xs font-bold">SKILLS · {skills}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="UE agents">
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-slate-400 pb-2"><div><h2 className="text-sm font-bold uppercase text-slate-950">UE Agents</h2><p className="text-xs font-semibold text-slate-700">Mobile robot / digital assistant endpoints; each has its own agent card</p></div><span className="text-xs font-bold text-slate-700">2 CONFIGURED</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { name: 'UE Agent 001', id: 'ue_agent_001', port: '8004', imsi: '001010123456789' },
            { name: 'UE Agent 002', id: 'ue_agent_002', port: '8107', imsi: '001010000000001' },
          ].map((agent) => (
            <article key={agent.id} className="flex items-start gap-3 border-2 border-slate-600 bg-white p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-slate-700 bg-slate-100 text-slate-950"><Bot className="h-5 w-5" /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2"><h3 className="text-sm font-bold uppercase text-slate-950">{agent.name}</h3><span className="text-xs font-bold text-slate-700">:{agent.port}</span></div><p className="mt-1 break-all text-xs font-semibold text-slate-800">{agent.id} · IMSI {agent.imsi}</p><p className="mt-2 text-xs font-bold text-sky-950">attach · service-request · peer-message</p></div>
            </article>
          ))}
        </div>
      </section>

      <section aria-label="A2A communication routes" className="border-2 border-slate-700 bg-white">
        <div className="border-b-2 border-slate-700 bg-slate-100 px-4 py-3"><h2 className="text-sm font-bold uppercase text-slate-950">A2A Communication Routes</h2></div>
        <div className="divide-y divide-slate-300">
          {routes.map((route) => (
            <div key={route.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(180px,1fr)_minmax(260px,2fr)] sm:items-center sm:gap-4">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-950"><span>{route.from}</span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-900" /><span>{route.to}</span></p>
              <p className="text-xs font-bold text-sky-950">{route.label}</p>
              <p className="text-sm font-medium text-slate-700">{route.detail}</p>
            </div>
          ))}
        </div>
        <p className="border-t border-slate-300 px-4 py-3 text-xs font-semibold text-slate-700">Every protected service call uses an OAuth bearer token. Factory robot cards and metrics are simulation data and are intentionally not shown as network agents.</p>
      </section>
    </div>
  </main>
);