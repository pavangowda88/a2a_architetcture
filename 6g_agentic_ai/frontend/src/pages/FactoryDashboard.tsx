import React from 'react';
import { CommandBar } from '../components/Chat/CommandBar';
import { TaskWorkspace, ConversationMessage, TaskRun } from '../components/Chat/TaskWorkspace';
import { ExecutionPipeline } from '../components/Pipeline/ExecutionPipeline';
import { FactoryTwin } from '../components/Factory/FactoryTwin';
import { EventLogPanel } from '../components/Events/EventLogPanel';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import {
  Robot,
  Station,
  Package,
  PipelineStage,
  FactoryEvent
} from '../types/factory';

interface FactoryDashboardProps {
  stations: Station[];
  robots: Robot[];
  packages: Package[];
  pipeline: PipelineStage[];
  events: FactoryEvent[];
  activeConveyor: boolean;
  laserScanning: boolean;
  isProcessingCommand: boolean;
  isCommandLocked: boolean;
  onSubmitCommand: (cmd: string) => void;
  onSelectRobot: (robot: Robot) => void;
  onSelectStation: (station: Station) => void;
  onSelectPackage: (pkg: Package) => void;
  conversation: ConversationMessage[];
  activeRun: TaskRun | null;
  backendConnected: boolean;
  onConfirmOperation: () => void;
  onCancelOperation: () => void;
  showFactorySimulation: boolean;
  onShowTaskWorkspace: () => void;
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
  isCommandLocked,
  onSubmitCommand,
  onSelectRobot,
  onSelectStation,
  onSelectPackage,
  conversation,
  activeRun,
  backendConnected,
  onConfirmOperation,
  onCancelOperation,
  showFactorySimulation,
  onShowTaskWorkspace,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#080b12] overflow-hidden">
      {/* Ask The Factory Command Input Bar */}
      <CommandBar onSubmitCommand={onSubmitCommand} isProcessing={isProcessingCommand} isLocked={isCommandLocked} />

      {showFactorySimulation && <div className="simulation-banner"><FlaskConical size={14} /><span>DEMO SIMULATION · Robot movement and station progress below are simulated</span><button type="button" onClick={onShowTaskWorkspace}><ArrowLeft size={14} /> Return to task workspace</button></div>}
      {showFactorySimulation && <ExecutionPipeline stages={pipeline} />}

      {/* Factory floor and activity stream */}
      <div className="dashboard-layout flex-1 flex min-h-0 overflow-hidden">
        <main className={`dashboard-center flex-1 min-w-0 min-h-0 ${showFactorySimulation ? 'simulation-center' : 'task-center'}`}>
          {showFactorySimulation ? <FactoryTwin
            stations={stations}
            robots={robots}
            packages={packages}
            activeConveyor={activeConveyor}
            laserScanning={laserScanning}
            onSelectRobot={onSelectRobot}
            onSelectStation={onSelectStation}
            onSelectPackage={onSelectPackage}
          /> : <TaskWorkspace
            conversation={conversation}
            activeRun={activeRun}
            isProcessing={isProcessingCommand}
            backendConnected={backendConnected}
            onConfirm={onConfirmOperation}
            onCancel={onCancelOperation}
          />}
        </main>

        {/* Recent activity */}
        <EventLogPanel events={events} />
      </div>
    </div>
  );
};
