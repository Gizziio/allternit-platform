/**
 * AgentSystemView - Unified Rails/DAK Interface
 * 
 * The main unified view combining Rails System (coordination) and DAK Runner (execution).
 * Features 6 contextual tabs: Plan, Work, Status, Mail, Tools, Audit
 */

import React, { useEffect } from "react";
import { useUnifiedStore, startAutoSync, stopAutoSync, type MainTab } from "@/lib/agents/unified.store";
import { TabBar } from "./components/TabBar";
import { ContextBanner } from "./components/ContextBanner";
import { PlanTab } from "./tabs/PlanTab";
import { WorkTab } from "./tabs/WorkTab";
import { StatusTab } from "./tabs/StatusTab";
import { MailTab } from "./tabs/MailTab";
import { ToolsTab } from "./tabs/ToolsTab";
import { AuditTab } from "./tabs/AuditTab";

export function AgentSystemView() {
  const { 
    activeMainTab, 
    setActiveMainTab, 
    contextMode,
    checkHealth,
    syncAll,
    health,
    error,
    clearError,
  } = useUnifiedStore();

  // Initialize connection and start auto-sync
  useEffect(() => {
    checkHealth();
    syncAll();
    startAutoSync(30000);
    
    return () => {
      stopAutoSync();
    };
  }, [checkHealth, syncAll]);

  const handleTabChange = (tab: MainTab) => {
    setActiveMainTab(tab);
  };

  const renderTabContent = () => {
    switch (activeMainTab) {
      case "plan":
        return <PlanTab />;
      case "work":
        return <WorkTab />;
      case "status":
        return <StatusTab />;
      case "mail":
        return <MailTab />;
      case "tools":
        return <ToolsTab />;
      case "audit":
        return <AuditTab />;
      default:
        return <PlanTab />;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(10,10,10,0.96),rgba(10,10,10,0.9))] text-foreground">
      {/* Context Banner */}
      <ContextBanner 
        mode={contextMode} 
        health={health}
        error={error}
        onDismissError={clearError}
      />
      
      {/* Tab Navigation */}
      <TabBar activeTab={activeMainTab} onTabChange={handleTabChange} />
      
      {/* Tab Content */}
      <div className="relative flex-1 overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  );
}

export default AgentSystemView;
