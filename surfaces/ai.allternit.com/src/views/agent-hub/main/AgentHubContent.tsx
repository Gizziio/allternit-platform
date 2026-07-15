import React from "react";
import { AgentView } from "../../AgentView";
import { PerformanceAnalyticsView } from "@/components/agents/PerformanceAnalyticsView";
import { AgentSessionsTab } from "./AgentSessionsTab";
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
        <div className="flex-1 overflow-auto p-8">
          <PerformanceAnalyticsView />
        </div>
      );
    default:
      return null;
  }
};
