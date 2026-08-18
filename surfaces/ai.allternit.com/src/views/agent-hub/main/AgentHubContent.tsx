import React from "react";
import { BotHubHomeTab } from "./BotHubHomeTab";
import { BotHubSessionsTab } from "./BotHubSessionsTab";
import type { AgentTab } from "./AgentHub.constants";

interface AgentHubContentProps {
  activeTab: AgentTab;
  onSessionStarted?: (sessionId: string) => void;
  onCreate?: () => void;
}

export const AgentHubContent: React.FC<AgentHubContentProps> = ({
  activeTab,
  onSessionStarted,
  onCreate,
}) => {
  switch (activeTab) {
    case 'bots':
      return (
        <div className="flex-1 overflow-hidden">
          <BotHubHomeTab onCreate={onCreate} />
        </div>
      );
    case 'sessions':
      return (
        <div className="flex-1 overflow-hidden">
          <BotHubSessionsTab onSessionStarted={onSessionStarted} />
        </div>
      );
    default:
      return null;
  }
};
