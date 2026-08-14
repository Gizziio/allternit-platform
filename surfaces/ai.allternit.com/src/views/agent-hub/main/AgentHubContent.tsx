import React from "react";
import { AgentView } from "../../AgentView";
import { PerformanceAnalyticsView } from "@/components/agents/PerformanceAnalyticsView";
import { AgentSessionsTab } from "./AgentSessionsTab";
import { AgentWorkspacePanel } from "@/components/agent-workspace/AgentWorkspacePanel";
import { AgentHubBotsTab } from "./AgentHubBotsTab";
import type { AgentTab } from "./AgentHub.constants";

interface AgentHubContentProps {
  activeTab: AgentTab;
}

export const AgentHubContent: React.FC<AgentHubContentProps> = ({ activeTab }) => {
  switch (activeTab) {
    case 'studio':
      return (
        <div className="flex-1 overflow-hidden">
          <AgentView title="Agent Studio" hideHeader />
        </div>
      );
    case 'sessions':
      return (
        <div className="flex-1 overflow-hidden">
          <AgentSessionsTab />
        </div>
      );
    case 'analytics':
      return (
        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl px-8 pb-12 pt-8">
            <PerformanceAnalyticsView />
          </div>
        </div>
      );
    case 'workspace':
      return (
        <div className="flex-1 overflow-hidden flex flex-col">
          <AgentWorkspacePanel />
        </div>
      );
    case 'bots':
      return (
        <div className="flex-1 overflow-hidden">
          <AgentHubBotsTab />
        </div>
      );
    default:
      return null;
  }
};
