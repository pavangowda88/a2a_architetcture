import React from 'react';
import { ArrowUpRight, Check, CircleAlert, Lightbulb, ShieldAlert } from 'lucide-react';
import { PageId } from '../components/Layout/Sidebar';

interface UICriticPageProps {
  onNavigate: (page: PageId) => void;
}

const findings = [
  {
    priority: 'High',
    title: 'Make service health reflect real connectivity',
    evidence: 'frontend/src/App.tsx · frontend/src/services/api.ts · chat_app.py',
    detail: 'The top bar was always told MCP and authentication were connected, even when a local service could be offline. Operators could mistake a demo state for a healthy network.',
    action: 'The header now polls the browser chat API and authenticated MCP tools endpoint every 15 seconds; unknown/loading state is shown as Demo/Checking.',
    icon: ShieldAlert,
    page: 'network' as PageId,
    pageLabel: 'Review agent network',
    complete: true,
  },
  {
    priority: 'High',
    title: 'Keep analytics internally consistent',
    evidence: 'frontend/src/pages/AnalyticsPage.tsx · frontend/src/App.tsx',
    detail: 'The total task card displayed values that did not come from its analytics props, so the headline and breakdown could disagree.',
    action: 'The breakdown now derives completed, active, queued, and failed counts from the same analytics object as the total.',
    icon: CircleAlert,
    page: 'analytics' as PageId,
    pageLabel: 'Open analytics',
    complete: true,
  },
  {
    priority: 'Medium',
    title: 'Keep navigation understandable on narrow screens',
    evidence: 'frontend/src/components/Layout/Sidebar.tsx · frontend/src/index.css',
    detail: 'The sidebar becomes icon-only on smaller screens. Tooltips help pointer users, but do not make every destination obvious to touch and keyboard users.',
    action: 'Implemented 44px scrollable mobile targets and explicit screen-reader names. A visible-label drawer remains a possible refinement.',
    icon: Lightbulb,
    page: 'factory' as PageId,
    pageLabel: 'Return to overview',
    complete: true,
  },
  {
    priority: 'Medium',
    title: 'Distinguish demonstration data from live telemetry',
    evidence: 'frontend/src/services/factoryState.ts · frontend/src/pages/SecurityCenterPage.tsx',
    detail: 'Several screens initialize with sample values. Without a source or freshness cue, a viewer may read them as production measurements.',
    action: 'Seeded topology, analytics, security, event, and MCP preview screens are now labeled as demo/sample data. Live security telemetry remains a backend integration task.',
    icon: Lightbulb,
    page: 'security' as PageId,
    pageLabel: 'Review security status',
    complete: true,
  },
  {
    priority: 'High',
    title: 'Keep local simulation separate from backend execution',
    evidence: 'frontend/src/App.tsx · frontend/src/services/api.ts',
    detail: 'Previously, matching words in a natural-language request started the client-side production animation regardless of backend outcome or pending MCP confirmation.',
    action: 'Implemented: factory runs use backend-owned virtual simulation state seeded from registered robot capabilities; no hardware commands are sent.',
    icon: ShieldAlert,
    page: 'factory' as PageId,
    pageLabel: 'Open factory overview',
    complete: true,
  },
  {
    priority: 'High',
    title: 'Feed the event view from real MCP outcomes',
    evidence: 'chat_app.py · frontend/src/services/api.ts',
    detail: 'The old WebSocket endpoint echoed client messages, while the UI never sent one. It could not deliver actual backend activity.',
    action: 'Implemented: the chat API broadcasts tool result states to connected dashboards and the client reconnects with cleanup.',
    icon: CircleAlert,
    page: 'logs' as PageId,
    pageLabel: 'Open system event log',
    complete: true,
  },
  {
    priority: 'High',
    title: 'Never present a local control as a hardware emergency stop',
    evidence: 'frontend/src/components/Factory/RobotDetailModal.tsx · frontend/src/App.tsx',
    detail: 'The robot modal changed local state and logged an E-STOP despite making no request to robot hardware.',
    action: 'Implemented: renamed the control to “Simulate stop · demo only” and logs clearly state that hardware was not contacted.',
    icon: ShieldAlert,
    page: 'factory' as PageId,
    pageLabel: 'Open factory overview',
    complete: true,
  },
  {
    priority: 'Medium',
    title: 'Replace seeded topology and security metrics with service data',
    evidence: 'frontend/src/services/factoryState.ts · frontend/src/pages/AgentNetworkPage.tsx · frontend/src/pages/SecurityCenterPage.tsx',
    detail: 'Most robot, agent, and security values remain local constants. The live header currently verifies the chat/MCP path only.',
    action: 'Next: add authenticated, typed registry and security telemetry endpoints, then show loading, empty, stale, and error states.',
    icon: Lightbulb,
    page: 'network' as PageId,
    pageLabel: 'Review agent network',
    complete: false,
  },
  {
    priority: 'Medium',
    title: 'Upgrade vulnerable Vite development tooling',
    evidence: 'frontend/package.json · frontend/package-lock.json',
    detail: 'npm audit reports one high and one moderate advisory affecting the current Vite/esbuild development toolchain.',
    action: 'Next: upgrade Vite and its React plugin together, then rerun the audit and production build. Keep the dev server local unless LAN access is required.',
    icon: ShieldAlert,
    page: 'critic' as PageId,
    pageLabel: 'Review all findings',
    complete: false,
  },
];

export const UICriticPage: React.FC<UICriticPageProps> = ({ onNavigate }) => (
  <main className="ui-critic-page flex-1 min-w-0 overflow-y-auto p-5 md:p-8">
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300">Product review · current frontend</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">UI critic</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">Evidence-based usability and trust review. Completed items describe changes made in this pass; open items are next steps.</p>
          </div>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">7 improvements implemented</span>
        </div>
      </header>

      <section aria-label="Critique findings" className="space-y-3">
        {findings.map((finding) => {
          const Icon = finding.icon;
          return (
            <article key={finding.title} className="glass-panel rounded-xl border p-4 md:p-5">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${finding.complete ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                  {finding.complete ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-100">{finding.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${finding.priority === 'High' ? 'bg-rose-500/10 text-rose-200' : 'bg-amber-500/10 text-amber-200'}`}>{finding.priority} priority</span>
                    {finding.complete && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">Implemented</span>}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{finding.detail}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{finding.action}</p>
                  <p className="mt-2 text-[10px] font-mono text-slate-500">Evidence: {finding.evidence}</p>
                  <button onClick={() => onNavigate(finding.page)} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 transition hover:border-emerald-500/40 hover:bg-emerald-500/5 focus-visible:outline-2 focus-visible:outline-emerald-300">
                    {finding.pageLabel}<ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
      <p className="text-[11px] leading-relaxed text-slate-500">This is a static code-informed review, not an automated runtime audit. Revisit findings as backend health and telemetry integrations change.</p>
    </div>
  </main>
);
