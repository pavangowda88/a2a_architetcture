import React from 'react';
import { CommandBar } from '../components/Chat/CommandBar';
import { ExecutionPipeline } from '../components/Pipeline/ExecutionPipeline';
import { FactoryTwin } from '../components/Factory/FactoryTwin';
import { AgentPanel } from '../components/Agents/AgentPanel';
import { EventLogPanel } from '../components/Events/EventLogPanel';
import {
  Robot,
  Station,
  Package,
  FactoryAgent,
  PipelineStage,
  FactoryEvent
} from '../types/factory';

interface FactoryDashboardProps {
  stations: Station[];
  robots: Robot[];
  packages: Package[];
  agents: FactoryAgent[];
  pipeline: PipelineStage[];
  events: FactoryEvent[];
  activeConveyor: boolean;
  laserScanning: boolean;
  isProcessingCommand: boolean;
  onSubmitCommand: (cmd: string) => void;
  onSelectRobot: (robot: Robot) => void;
  onSelectStation: (station: Station) => void;
  onSelectPackage: (pkg: Package) => void;
  onSelectAgent: (agent: FactoryAgent) => void;
}

export const FactoryDashboard: React.FC<FactoryDashboardProps> = ({
  stations,
  robots,
  packages,
  agents,
  pipeline,
  events,
  activeConveyor,
  laserScanning,
  isProcessingCommand,
  onSubmitCommand,
  onSelectRobot,
  onSelectStation,
  onSelectPackage,
  onSelectAgent,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080b12] overflow-hidden">
      {/* Ask The Factory Command Input Bar */}
      <CommandBar onSubmitCommand={onSubmitCommand} isProcessing={isProcessingCommand} />

      {/* Real-time 10-Stage Execution Pipeline */}
      <ExecutionPipeline stages={pipeline} />

      {/* Main 3-Column Screen Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Column: Agent Panel (A2A Network) */}
        <AgentPanel agents={agents} onSelectAgent={onSelectAgent} />

        {/* Center Main Area: Factory Digital Twin */}
        <main className="flex-1 p-3 min-w-0 min-h-0 flex flex-col justify-between">
          <FactoryTwin
            stations={stations}
            robots={robots}
            packages={packages}
            activeConveyor={activeConveyor}
            laserScanning={laserScanning}
            onSelectRobot={onSelectRobot}
            onSelectStation={onSelectStation}
            onSelectPackage={onSelectPackage}
          />
        </main>

        {/* Right Column: Live Event Log */}
        <EventLogPanel events={events} />
      </div>
    </div>
  );
};
