import React from "react";
import { useAgentStore } from "@/lib/agents";
import { AgentView, CreateAgentForm } from "../../AgentView";
import { MemoryKernelView } from "../../MemoryKernelView";
import { PerformanceAnalyticsView } from "@/components/agents/PerformanceAnalyticsView";
import { WorkspaceTab } from "../../WorkspaceTab";
import { REGISTRY_CONTEXT, type AgentTab } from "./AgentHub.constants";

interface AgentHubContentProps {
  activeTab: AgentTab;
}

export const AgentHubContent: React.FC<AgentHubContentProps> = ({ activeTab }) => {
  const { agents } = useAgentStore();

  switch (activeTab) {
    case 'studio':
      return (
        <div className="flex-1 overflow-auto p-8 pt-6">
          <CreateAgentForm onClose={() => {}} />
        </div>
      );
    case 'registry':
      return (
        <div className="flex-1 overflow-hidden">
          <AgentView context={REGISTRY_CONTEXT} />
        </div>
      );
    case 'memory':
      return (
        <div className="flex-1 overflow-auto">
          <MemoryKernelView />
        </div>
      );
    case 'analytics':
      return (
        <div className="flex-1 overflow-auto p-8">
          <PerformanceAnalyticsView />
        </div>
      );
    case 'workspace':
      return (
        <div className="flex-1 overflow-hidden">
          <WorkspaceTab />
        </div>
      );
    default:
      return null;
  }
};
