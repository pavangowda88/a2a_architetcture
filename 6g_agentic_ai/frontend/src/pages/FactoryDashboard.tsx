import React from 'react';
import { CommandBar } from '../components/Chat/CommandBar';
import { ExecutionPipeline } from '../components/Pipeline/ExecutionPipeline';
import { FactoryTwin } from '../components/Factory/FactoryTwin';
import { EventLogPanel } from '../components/Events/EventLogPanel';
import {
  Robot,
  Station,
  Package,
  PipelineStage,
  FactoryEvent
} from '../types/factory';
import { CommandOutputPanel, CommandToolStep } from '../components/Chat/CommandOutputPanel';

interface FactoryDashboardProps {
  stations: Station[];
  robots: Robot[];
  packages: Package[];
  pipeline: PipelineStage[];
  events: FactoryEvent[];
  activeConveyor: boolean;
  laserScanning: boolean;
  isProcessingCommand: boolean;
  onSubmitCommand: (cmd: string) => void;
  onSelectRobot: (robot: Robot) => void;
  onSelectStation: (station: Station) => void;
  onSelectPackage: (pkg: Package) => void;
  commandOutput: { command: string; markdown: string; steps: CommandToolStep[] } | null;
  onCloseCommandOutput: () => void;
}

export const FactoryDashboard: React.FC<FactoryDashboardProps> = ({
  stations,
  robots,
  packages,
  pipeline,
  events,
  activeConveyor,
  laserScanning,
  isProcessingCommand,
  onSubmitCommand,
  onSelectRobot,
  onSelectStation,
  onSelectPackage,
  commandOutput,
  onCloseCommandOutput,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080b12] overflow-hidden">
      {/* Ask The Factory Command Input Bar */}
      <CommandBar onSubmitCommand={onSubmitCommand} isProcessing={isProcessingCommand} />

      {/* Compact workflow status */}
      <ExecutionPipeline stages={pipeline} />

      {/* Factory floor and activity stream */}
      <div className="dashboard-layout flex-1 flex min-h-0 overflow-hidden">
        {/* Factory floor */}
        <main className="dashboard-center flex-1 p-3 min-w-0 min-h-0 flex flex-col justify-between">
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

        {/* Recent activity */}
        <EventLogPanel events={events} />
      </div>
      {commandOutput && (
        <CommandOutputPanel
          command={commandOutput.command}
          markdown={commandOutput.markdown}
          steps={commandOutput.steps}
          onClose={onCloseCommandOutput}
        />
      )}
    </div>
  );
};
