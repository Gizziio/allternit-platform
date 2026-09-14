import React from "react";
import { BotHubHomeTab } from "./BotHubHomeTab";
import { BotHubSessionsTab } from "./BotHubSessionsTab";
import { AgentView } from "../../AgentView";
import { PerformanceAnalyticsView } from "@/components/agents/PerformanceAnalyticsView";
import { AgentSessionsTab } from "./AgentSessionsTab";
import { AgentWorkspacePanel } from "@/components/agent-workspace/AgentWorkspacePanel";
import { TagManagerView } from "@/views/tags/TagManagerView";
import type { AgentTab } from "./AgentHub.constants";

interface AgentHubContentProps {
  activeTab: AgentTab;
  onSessionStarted?: (sessionId: string, botId: string) => void;
}

export const AgentHubContent: React.FC<AgentHubContentProps> = ({
  activeTab,
  onSessionStarted,
}) => {
  switch (activeTab) {
    case 'bots':
      return (
        <div className="flex-1 overflow-hidden">
          <BotHubHomeTab />
        </div>
      );
    case 'sessions':
      return (
        <div className="flex-1 overflow-hidden">
          <BotHubSessionsTab onSessionStarted={onSessionStarted} />
          <AgentSessionsTab />
        </div>
      );
    case 'tags':
      return (
        <div className="flex-1 overflow-auto">
          <TagManagerView />
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
    default:
      return null;
  }
};
